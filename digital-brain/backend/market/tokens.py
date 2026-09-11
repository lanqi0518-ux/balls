"""Fresh-launch Solana token candidate pool.

Every ``refresh_interval`` seconds:
    1. Pull freshly-minted coins from pump.fun (the real 'gmgn.ai fresh
       launches' upstream — gmgn's own JSON is Cloudflare-blocked for
       bare HTTPS, but pump.fun's ``frontend-api-v3`` is not, and it
       carries every SOL meme from the moment of birth, well before any
       tracker picks it up).
    2. Also pull DexScreener's "boosted" list (people actively paying to
       promote) and "latest token profiles" as additional signal.
    3. Batch-hydrate all candidate mints via DexScreener's tokens()
       endpoint to get proper pair snapshots (price, liquidity, volume).
    4. Filter out anything that's already a mega-cap so the brain
       doesn't keep reasoning about BNB/PEPE/WIF-scale established coins
       — the point of this loop is to find NEW opportunities, not blue
       chips.
    5. Rank by a heat score that heavily favours youth + activity.
    6. Keep the top N in memory as the brain's active candidate pool.

Consumers get:
    * ``snapshot()``               — the ranked ``PairSnapshot`` list
    * ``fresh_launches_public()``  — the raw pump.fun feed (for the UI)
    * ``is_fresh_launch(mint)``    — was this mint born on pump.fun in
                                     the last few hours?
"""

from __future__ import annotations

import asyncio
import logging
import math
import time
from typing import Dict, List, Optional, Set

from .dexscreener import DexScreenerClient, PairSnapshot
from .pump_fun import FreshCoin, PumpFunClient


LOG = logging.getLogger("market.tokens")


# We deliberately DO NOT seed any established mega-caps here (no SOL,
# WIF, BONK, POPCAT, JLP, JUP…). The brain's job is to notice new
# things — feeding it the same old blue chips just anchors its
# attention on stuff every other bot on earth is already competing
# over. The candidate pool is instead built fresh each cycle from
# pump.fun + DexScreener's "new profiles" / "boosted" streams.
DEFAULT_SEED_TOKENS: List[str] = []


# Anything above this fully-diluted valuation is considered "already
# discovered". The brain's fresh-launch loop skips it — we only want
# NEW / small candidates. Configurable via env at boot.
DEFAULT_MAX_FDV_USD = 50_000_000.0

# Ignore anything younger than this many seconds — the pair may not
# have real liquidity yet and DexScreener may not have priced it.
MIN_AGE_SECONDS = 60.0


class TrendingTokenWatcher:
    """Fresh-launch candidate pool. (Kept the class name for backward
    compatibility with the rest of the codebase; semantically this is
    now a *fresh-launch* watcher, not a trending list.)"""

    def __init__(self,
                 client: Optional[DexScreenerClient] = None,
                 pumpfun: Optional[PumpFunClient] = None,
                 chain: str = "solana",
                 top_n: int = 30,
                 refresh_interval: float = 45.0,
                 seed_addresses: Optional[List[str]] = None,
                 max_fdv_usd: float = DEFAULT_MAX_FDV_USD,
                 fresh_pool_size: int = 40):
        self.client = client or DexScreenerClient()
        self.pumpfun = pumpfun or PumpFunClient()
        self.chain = chain
        self.top_n = top_n
        self.refresh_interval = refresh_interval
        self.seed_addresses: List[str] = list(seed_addresses or DEFAULT_SEED_TOKENS)
        self.max_fdv_usd = max_fdv_usd
        self.fresh_pool_size = fresh_pool_size

        self._pairs: List[PairSnapshot] = []
        self._fresh_launches: List[FreshCoin] = []
        self._fresh_by_mint: Dict[str, FreshCoin] = {}
        self._last_refresh_at: float = 0.0
        self._last_source_counts: Dict[str, int] = {}
        self._task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()

    # ------------------------------------------------------------------

    async def start(self) -> None:
        if self._task is None:
            self._stop.clear()
            self._task = asyncio.create_task(self._loop(), name="fresh-tokens")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None

    def snapshot(self) -> List[PairSnapshot]:
        return list(self._pairs)

    def snapshot_public(self) -> List[dict]:
        out = []
        for p in self._pairs:
            d = p.to_public()
            fresh = self._fresh_by_mint.get(p.base_address)
            if fresh is not None:
                d["is_fresh_launch"] = True
                d["fresh_age_minutes"] = round(fresh.age_minutes, 1)
                d["source"] = "pump.fun"
            else:
                d["is_fresh_launch"] = False
                d["source"] = "dexscreener"
            out.append(d)
        return out

    def fresh_launches_public(self) -> List[dict]:
        return [c.to_public() for c in self._fresh_launches[:self.fresh_pool_size]]

    def is_fresh_launch(self, mint: str) -> bool:
        return mint in self._fresh_by_mint

    def fresh_launch_meta(self, mint: str) -> Optional[FreshCoin]:
        return self._fresh_by_mint.get(mint)

    def status(self) -> dict:
        return {
            "chain": self.chain,
            "count": len(self._pairs),
            "fresh_launches_seen": len(self._fresh_launches),
            "last_refresh_ms": int(self._last_refresh_at * 1000) if self._last_refresh_at else 0,
            "refresh_interval": self.refresh_interval,
            "max_fdv_usd": self.max_fdv_usd,
            "source_counts": dict(self._last_source_counts),
        }

    # ------------------------------------------------------------------

    async def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                await self._refresh_once()
            except Exception as e:  # noqa: BLE001
                LOG.warning("fresh-token refresh failed: %s", e)
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.refresh_interval)
            except asyncio.TimeoutError:
                pass

    async def _refresh_once(self) -> None:
        addrs: Set[str] = set(self.seed_addresses)
        source_counts: Dict[str, int] = {"seed": len(self.seed_addresses)}

        # (1) Freshest pump.fun launches — the real "new project" upstream.
        fresh = await self.pumpfun.fresh_coins(limit=self.fresh_pool_size)
        # Keep only sanely-aged coins and de-dup by mint.
        fresh = [c for c in fresh if c.age_minutes * 60.0 >= MIN_AGE_SECONDS]
        self._fresh_launches = fresh
        self._fresh_by_mint = {c.mint: c for c in fresh}
        for c in fresh:
            addrs.add(c.mint)
        source_counts["pump_fun_fresh"] = len(fresh)

        # (2) DexScreener boosted — people actively promoting.
        boosted_added = 0
        try:
            boosted = await self.client.token_boosts_top()
            for t in boosted:
                if t.get("chainId") == self.chain and t.get("tokenAddress"):
                    addrs.add(t["tokenAddress"])
                    boosted_added += 1
        except Exception:
            pass
        source_counts["dex_boosted"] = boosted_added

        # (3) DexScreener latest token profiles — freshly-added listings.
        profiles_added = 0
        try:
            profiles = await self.client.token_profiles_latest()
            for t in profiles:
                if t.get("chainId") == self.chain and t.get("tokenAddress"):
                    addrs.add(t["tokenAddress"])
                    profiles_added += 1
        except Exception:
            pass
        source_counts["dex_profiles"] = profiles_added

        # DexScreener token endpoint accepts up to 30 comma-separated addresses.
        addrs_list = list(addrs)[:30]
        pairs = await self.client.tokens(self.chain, addrs_list)

        # Deduplicate: same base token can have multiple pools.
        best_per_base: Dict[str, PairSnapshot] = {}
        for p in pairs:
            if p.chain != self.chain:
                continue
            key = p.base_address or p.pair_address
            prev = best_per_base.get(key)
            if prev is None or p.liquidity_usd > prev.liquidity_usd:
                best_per_base[key] = p

        # Filter out mega-caps. If a pair has no FDV info we let it through
        # (usually the case for freshly-launched pump.fun tokens whose FDV
        # hasn't been reported yet). We DO keep it if it's on our fresh
        # launch list — those are always in-scope regardless of FDV.
        filtered: List[PairSnapshot] = []
        rejected_megacap = 0
        for p in best_per_base.values():
            is_fresh = p.base_address in self._fresh_by_mint
            fdv = p.fdv or p.market_cap or 0.0
            if not is_fresh and fdv and fdv > self.max_fdv_usd:
                rejected_megacap += 1
                continue
            filtered.append(p)
        source_counts["rejected_megacap"] = rejected_megacap

        # Heat score that heavily rewards YOUTH + activity.
        def heat(p: PairSnapshot) -> float:
            liq = max(p.liquidity_usd, 1.0)
            vol_ratio = p.volume_h24 / liq if liq else 0.0
            move = abs(p.price_change_h1) + 0.5 * abs(p.price_change_h24)
            youth_bonus = 0.0
            fresh = self._fresh_by_mint.get(p.base_address)
            if fresh is not None:
                # Younger is better; a coin 30 min old scores +3, a coin
                # 3 h old scores +1, older than 6 h scores ~0.
                age_h = max(0.1, fresh.age_minutes / 60.0)
                youth_bonus = max(0.0, 3.5 - math.log2(1 + age_h) * 1.5)
            base_score = math.log10(1 + liq) + 1.3 * math.log10(1 + vol_ratio) + 0.02 * move
            return base_score + youth_bonus

        ordered = sorted(filtered, key=heat, reverse=True)
        self._pairs = ordered[: self.top_n]
        self._last_refresh_at = time.time()
        self._last_source_counts = source_counts
        LOG.info("fresh-tokens: kept %d Solana pairs from %d addrs "
                 "(fresh=%d, boosted=%d, profiles=%d, rejected_megacap=%d)",
                 len(self._pairs), len(addrs_list),
                 source_counts.get("pump_fun_fresh", 0),
                 source_counts.get("dex_boosted", 0),
                 source_counts.get("dex_profiles", 0),
                 source_counts.get("rejected_megacap", 0))
