"""Trending Solana meme-token watcher.

Every ``refresh_interval`` seconds:
    1. Ask DexScreener for boosted / trending / latest tokens
    2. Filter to Solana
    3. Batch-hydrate them via ``tokens(chain, addrs)`` to get full pair snapshots
    4. Rank by a simple heat score (liquidity-weighted 1h & 24h volume + move)
    5. Keep the top N in memory

Other components consume ``TrendingTokenWatcher.snapshot()`` — a fresh
list of ``PairSnapshot``.
"""

from __future__ import annotations

import asyncio
import logging
import math
import time
from typing import List, Optional, Set

from .dexscreener import DexScreenerClient, PairSnapshot


LOG = logging.getLogger("market.tokens")


# Some ever-liquid Solana staples we always want to watch, so the panel
# is never empty (SOL/USDC, WIF/SOL, BONK/SOL, PEPE-on-sol/SOL). All by
# base-token mint address; DexScreener returns every pool for the mint.
DEFAULT_SEED_TOKENS = [
    "So11111111111111111111111111111111111111112",   # Wrapped SOL
    "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",  # WIF
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",  # BONK
    "5z3EqYQo9HiCEs3R84RCDMu2n7anpDMxRhdK8PSWmrRC",  # POPCAT
    "Bybit1okXf65J9Yby9adcTfHHnLakwLcYTbjnLDbNAKn",  # placeholder — dropped if 404
    "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4",  # JLP
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",   # JUP
    "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",  # ORCA (varies)
    "DqXVfhgH9F1o1z4NX4Z2S1DPqL7ihqbg2xayeXV1eQrb",  # AI16Z variant (illustrative)
    "63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9",  # HOUSE (illustrative)
]


class TrendingTokenWatcher:
    def __init__(self,
                 client: Optional[DexScreenerClient] = None,
                 chain: str = "solana",
                 top_n: int = 30,
                 refresh_interval: float = 45.0,
                 seed_addresses: Optional[List[str]] = None):
        self.client = client or DexScreenerClient()
        self.chain = chain
        self.top_n = top_n
        self.refresh_interval = refresh_interval
        self.seed_addresses: List[str] = list(seed_addresses or DEFAULT_SEED_TOKENS)
        self._pairs: List[PairSnapshot] = []
        self._last_refresh_at: float = 0.0
        self._task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()

    # ------------------------------------------------------------------

    async def start(self) -> None:
        if self._task is None:
            self._stop.clear()
            self._task = asyncio.create_task(self._loop(), name="trending-tokens")

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
        return [p.to_public() for p in self._pairs]

    def status(self) -> dict:
        return {
            "chain": self.chain,
            "count": len(self._pairs),
            "last_refresh_ms": int(self._last_refresh_at * 1000) if self._last_refresh_at else 0,
            "refresh_interval": self.refresh_interval,
        }

    # ------------------------------------------------------------------

    async def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                await self._refresh_once()
            except Exception as e:  # noqa: BLE001
                LOG.warning("trending refresh failed: %s", e)
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.refresh_interval)
            except asyncio.TimeoutError:
                pass

    async def _refresh_once(self) -> None:
        addrs: Set[str] = set(self.seed_addresses)

        # Boosted (people paid to promote) — often the meme du jour.
        boosted = await self.client.token_boosts_top()
        for t in boosted:
            if t.get("chainId") == self.chain and t.get("tokenAddress"):
                addrs.add(t["tokenAddress"])

        # Also grab latest profiles — freshly-launched tokens.
        profiles = await self.client.token_profiles_latest()
        for t in profiles:
            if t.get("chainId") == self.chain and t.get("tokenAddress"):
                addrs.add(t["tokenAddress"])

        # DexScreener token endpoint accepts up to 30 comma-separated addresses.
        addrs_list = list(addrs)[:30]
        pairs = await self.client.tokens(self.chain, addrs_list)

        # Deduplicate: same base token can have multiple pools; keep the highest-liquidity pool per base.
        best_per_base: dict = {}
        for p in pairs:
            if p.chain != self.chain:
                continue
            key = p.base_address or p.pair_address
            prev = best_per_base.get(key)
            if prev is None or p.liquidity_usd > prev.liquidity_usd:
                best_per_base[key] = p

        # Rank by a simple heat score.
        def heat(p: PairSnapshot) -> float:
            liq = max(p.liquidity_usd, 1.0)
            vol_ratio = p.volume_h24 / liq if liq else 0.0
            move = abs(p.price_change_h1) + 0.5 * abs(p.price_change_h24)
            return math.log10(1 + liq) + 1.3 * math.log10(1 + vol_ratio) + 0.02 * move

        ordered = sorted(best_per_base.values(), key=heat, reverse=True)
        self._pairs = ordered[: self.top_n]
        self._last_refresh_at = time.time()
        LOG.info("trending: %d Solana pairs (from %d fetched)",
                 len(self._pairs), len(pairs))
