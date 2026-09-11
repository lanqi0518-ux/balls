"""Fresh-launch Solana token candidate pool.

Every ``refresh_interval`` seconds:
    1. Pull freshly-minted coins from **every** Solana launchpad we can
       reach without auth: pump.fun, LetsBonk / bonk.fun, Believe /
       Clanker, Moonshot, Jupiter Studio, and Raydium LaunchLab. See
       ``launchpads.MultiLaunchpadWatcher``.
    2. Also pull DexScreener's boosted list + latest token profiles as
       additional signal.
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
    * ``fresh_launches_public()``  — every fresh launch across every
                                     launchpad (for the UI)
    * ``is_fresh_launch(mint)``    — was this mint born on any of the
                                     launchpads in the last few hours?
    * ``launchpad_for(mint)``      — pump.fun / letsbonk / moonshot / …
"""

from __future__ import annotations

import asyncio
import logging
import math
import time
from typing import Dict, List, Optional, Set

from .dexscreener import DexScreenerClient, PairSnapshot
from .pump_fun import FreshCoin, PumpFunClient
from .launchpads import MultiLaunchpadWatcher, launchpad_of


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
                 launchpads: Optional[MultiLaunchpadWatcher] = None,
                 chain: str = "solana",
                 chains: Optional[List[str]] = None,
                 top_n: int = 30,
                 refresh_interval: float = 45.0,
                 seed_addresses: Optional[List[str]] = None,
                 max_fdv_usd: float = DEFAULT_MAX_FDV_USD,
                 fresh_pool_size: int = 60):
        self.client = client or DexScreenerClient()
        self.pumpfun = pumpfun or PumpFunClient()
        self.launchpads = launchpads or MultiLaunchpadWatcher(
            dex=self.client, pumpfun=self.pumpfun,
        )
        # `chain` retained for backward compatibility. `chains` is the
        # real driver — the watcher hydrates fresh launches across every
        # listed chain and merges them into a single candidate pool.
        self.chain = chain
        self.chains: List[str] = list(chains) if chains else [chain, "robinhood"]
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
        self._launchpad_counts: Dict[str, int] = {}
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
                d["launchpad"] = launchpad_of(fresh)
                d["source"] = d["launchpad"]
            else:
                d["is_fresh_launch"] = False
                d["launchpad"] = "unknown"
                d["source"] = "dexscreener"
            out.append(d)
        return out

    def fresh_launches_public(self) -> List[dict]:
        return [c.to_public() for c in self._fresh_launches[:self.fresh_pool_size]]

    def is_fresh_launch(self, mint: str) -> bool:
        return mint in self._fresh_by_mint

    def fresh_launch_meta(self, mint: str) -> Optional[FreshCoin]:
        return self._fresh_by_mint.get(mint)

    def launchpad_for(self, mint: str) -> Optional[str]:
        c = self._fresh_by_mint.get(mint)
        return launchpad_of(c) if c else None

    def status(self) -> dict:
        chain_counts: Dict[str, int] = {}
        for p in self._pairs:
            chain_counts[p.chain] = chain_counts.get(p.chain, 0) + 1
        return {
            "chain": self.chain,
            "chains": list(self.chains),
            "count": len(self._pairs),
            "chain_counts": chain_counts,
            "fresh_launches_seen": len(self._fresh_launches),
            "last_refresh_ms": int(self._last_refresh_at * 1000) if self._last_refresh_at else 0,
            "refresh_interval": self.refresh_interval,
            "max_fdv_usd": self.max_fdv_usd,
            "source_counts": dict(self._last_source_counts),
            "launchpad_counts": dict(self._launchpad_counts),
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
        source_counts: Dict[str, int] = {"seed": len(self.seed_addresses)}

        # (1) Ask every launchpad we can reach at once. `all_fresh` now
        # includes Robinhood Chain sources alongside every Solana
        # launchpad, so `fresh` is multi-chain from here on.
        fresh, per_source = await self.launchpads.all_fresh(
            per_source_limit=max(self.fresh_pool_size // 3, 15),
        )
        fresh = [c for c in fresh if c.age_minutes * 60.0 >= MIN_AGE_SECONDS or c.age_minutes == 0.0]
        self._fresh_launches = fresh
        self._fresh_by_mint = {c.mint: c for c in fresh}
        source_counts.update({f"launchpad::{k}": v for k, v in per_source.items()})

        # Per-launchpad tally (across the deduped final set).
        pad_counts: Dict[str, int] = {}
        for c in fresh:
            pad = launchpad_of(c)
            pad_counts[pad] = pad_counts.get(pad, 0) + 1
        self._launchpad_counts = pad_counts

        # (2) Bucket candidate addrs by chain, then hydrate each chain
        # via a separate DexScreener `tokens(chain, addrs)` call. The
        # DexScreener tokens endpoint accepts up to 30 comma-separated
        # addresses per call, so we cap per-chain.
        addrs_by_chain: Dict[str, Set[str]] = {c: set() for c in self.chains}
        # Seed addresses default to the primary chain.
        for a in self.seed_addresses:
            addrs_by_chain.setdefault(self.chain, set()).add(a)
        for c in fresh:
            chain = (c.chain or self.chain)
            if chain not in addrs_by_chain:
                addrs_by_chain[chain] = set()
            addrs_by_chain[chain].add(c.mint)

        # Kick off one hydration call per chain in parallel.
        hydrate_tasks = []
        chain_order: List[str] = []
        for chain, addrs in addrs_by_chain.items():
            if not addrs:
                continue
            chain_order.append(chain)
            hydrate_tasks.append(
                self.client.tokens(chain, list(addrs)[:30])
            )
        hydrated = await asyncio.gather(*hydrate_tasks, return_exceptions=True)

        # Deduplicate: same base token can have multiple pools.
        best_per_base: Dict[str, PairSnapshot] = {}
        for chain, result in zip(chain_order, hydrated):
            if isinstance(result, Exception):
                LOG.debug("hydration failed for chain=%s: %s", chain, result)
                continue
            for p in result:
                if p.chain not in self.chains:
                    continue
                key = f"{p.chain}::{p.base_address or p.pair_address}"
                prev = best_per_base.get(key)
                if prev is None or p.liquidity_usd > prev.liquidity_usd:
                    best_per_base[key] = p

        # Filter out mega-caps ON SOLANA. The mega-cap avoidance was
        # designed for Solana because that ecosystem is dominated by
        # BNB/PEPE/WIF-scale tokens every bot already competes on. On
        # smaller chains like Robinhood Chain the big-cap movers ARE
        # the alpha (e.g. $PONS at $400M mcap is one of the top movers
        # on the entire chain), so we intentionally don't filter them.
        filtered: List[PairSnapshot] = []
        rejected_megacap = 0
        for p in best_per_base.values():
            is_fresh = p.base_address in self._fresh_by_mint
            fdv = p.fdv or p.market_cap or 0.0
            apply_cap = (p.chain == "solana")
            if apply_cap and not is_fresh and fdv and fdv > self.max_fdv_usd:
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
        total_addrs = sum(len(v) for v in addrs_by_chain.values())
        chain_kept: Dict[str, int] = {}
        for p in self._pairs:
            chain_kept[p.chain] = chain_kept.get(p.chain, 0) + 1
        LOG.info("fresh-tokens: kept %d pairs from %d addrs across %s "
                 "(launchpads=%s, chains=%s, rejected_megacap=%d)",
                 len(self._pairs), total_addrs, sorted(self.chains),
                 pad_counts, chain_kept,
                 source_counts.get("rejected_megacap", 0))
