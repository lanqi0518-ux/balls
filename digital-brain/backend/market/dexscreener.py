"""Minimal async DexScreener client. Public API, no key required.

Docs: https://docs.dexscreener.com/api/reference

We only use the pieces we need:
    * search_pairs(q)                   — free-text search across all chains
    * pair(chain, pair_address)         — single pair snapshot
    * tokens(chain, [addresses])        — batch token info
    * token_profiles_latest()           — recently-added tokens across chains
    * token_boosts_top()                — tokens people are actively promoting
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Iterable, List, Optional

import urllib.parse
import urllib.request
import json


DEXSCREENER_BASE = "https://api.dexscreener.com"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 DigitalBrain/1.0"
)


@dataclass
class PairSnapshot:
    chain: str
    dex: str
    pair_address: str
    base_symbol: str
    base_address: str
    price_usd: float
    price_native: float
    liquidity_usd: float
    volume_h24: float
    volume_h1: float
    volume_m5: float
    price_change_m5: float
    price_change_h1: float
    price_change_h24: float
    txns_h1_buys: int
    txns_h1_sells: int
    txns_m5_buys: int
    txns_m5_sells: int
    fdv: float
    market_cap: float
    pair_created_at_ms: int
    url: str
    raw: dict = field(default_factory=dict, repr=False)

    @classmethod
    def from_raw(cls, r: dict) -> "PairSnapshot":
        def f(x, default=0.0):
            try:
                return float(x)
            except Exception:
                return default

        def i(x, default=0):
            try:
                return int(x)
            except Exception:
                return default

        base = r.get("baseToken", {}) or {}
        volume = r.get("volume", {}) or {}
        pchg = r.get("priceChange", {}) or {}
        txns = r.get("txns", {}) or {}
        liq = r.get("liquidity", {}) or {}
        return cls(
            chain=r.get("chainId", ""),
            dex=r.get("dexId", ""),
            pair_address=r.get("pairAddress", "") or "",
            base_symbol=(base.get("symbol") or "").upper(),
            base_address=base.get("address", "") or "",
            price_usd=f(r.get("priceUsd")),
            price_native=f(r.get("priceNative")),
            liquidity_usd=f(liq.get("usd")),
            volume_h24=f(volume.get("h24")),
            volume_h1=f(volume.get("h1")),
            volume_m5=f(volume.get("m5")),
            price_change_m5=f(pchg.get("m5")),
            price_change_h1=f(pchg.get("h1")),
            price_change_h24=f(pchg.get("h24")),
            txns_h1_buys=i((txns.get("h1") or {}).get("buys")),
            txns_h1_sells=i((txns.get("h1") or {}).get("sells")),
            txns_m5_buys=i((txns.get("m5") or {}).get("buys")),
            txns_m5_sells=i((txns.get("m5") or {}).get("sells")),
            fdv=f(r.get("fdv")),
            market_cap=f(r.get("marketCap")),
            pair_created_at_ms=i(r.get("pairCreatedAt")),
            url=r.get("url", "") or "",
            raw=r,
        )

    @property
    def age_hours(self) -> float:
        if not self.pair_created_at_ms:
            return 0.0
        return (time.time() * 1000 - self.pair_created_at_ms) / 3_600_000

    def to_public(self) -> dict:
        return {
            "chain": self.chain,
            "dex": self.dex,
            "pair_address": self.pair_address,
            "base_symbol": self.base_symbol,
            "base_address": self.base_address,
            "price_usd": self.price_usd,
            "liquidity_usd": self.liquidity_usd,
            "volume_h24": self.volume_h24,
            "volume_h1": self.volume_h1,
            "price_change_m5": self.price_change_m5,
            "price_change_h1": self.price_change_h1,
            "price_change_h24": self.price_change_h24,
            "buys_h1": self.txns_h1_buys,
            "sells_h1": self.txns_h1_sells,
            "buys_m5": self.txns_m5_buys,
            "sells_m5": self.txns_m5_sells,
            "fdv": self.fdv,
            "market_cap": self.market_cap,
            "age_hours": round(self.age_hours, 2),
            "url": self.url,
        }


class DexScreenerClient:
    """Very small blocking-in-thread wrapper — urllib is fine for our needs."""

    def __init__(self, base: str = DEXSCREENER_BASE, timeout: float = 12.0):
        self.base = base.rstrip("/")
        self.timeout = timeout

    # ---------- low level ----------

    def _get_sync(self, path: str, params: Optional[dict] = None) -> dict:
        url = self.base + path
        if params:
            q = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
            url = f"{url}?{q}"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT,
                                                    "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))

    async def _get(self, path: str, params: Optional[dict] = None) -> dict:
        return await asyncio.to_thread(self._get_sync, path, params)

    # ---------- high level ----------

    async def search_pairs(self, query: str) -> List[PairSnapshot]:
        data = await self._get("/latest/dex/search", {"q": query})
        pairs = data.get("pairs") or []
        return [PairSnapshot.from_raw(p) for p in pairs]

    async def token_profiles_latest(self) -> List[dict]:
        try:
            data = await self._get("/token-profiles/latest/v1", None)
        except Exception:
            return []
        return data if isinstance(data, list) else []

    async def token_boosts_top(self) -> List[dict]:
        try:
            data = await self._get("/token-boosts/top/v1", None)
        except Exception:
            return []
        return data if isinstance(data, list) else []

    async def tokens(self, chain: str, addresses: Iterable[str]) -> List[PairSnapshot]:
        addrs = ",".join([a for a in addresses if a])
        if not addrs:
            return []
        try:
            data = await self._get(f"/latest/dex/tokens/{addrs}", None)
        except Exception:
            return []
        pairs = data.get("pairs") or []
        return [PairSnapshot.from_raw(p) for p in pairs]

    async def pair(self, chain: str, pair_address: str) -> Optional[PairSnapshot]:
        try:
            data = await self._get(f"/latest/dex/pairs/{chain}/{pair_address}", None)
        except Exception:
            return None
        pairs = data.get("pairs") or []
        return PairSnapshot.from_raw(pairs[0]) if pairs else None
