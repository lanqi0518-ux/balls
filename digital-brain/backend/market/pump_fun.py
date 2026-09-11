"""Pump.fun client — fresh-launch feed for the brain.

Why this exists
---------------
The brain used to reason about the same handful of established Solana
mega-caps (SOL, WIF, BONK, POPCAT, JLP, JUP…) because those were the
tokens it was force-fed via a hardcoded seed list and via DexScreener's
"boosted/latest" endpoints, which are dominated by whatever's been alive
for a while.

The user asked for the opposite: **fresh launches**, freshly-minted
sub-500K-mcap tokens that a smart trader would actually be hunting.
gmgn.ai is the popular UI for this, but their JSON endpoints are gated
by Cloudflare (bare HTTPS from our VM returns 403 "Attention Required").

pump.fun is where ~90% of Solana memes are actually created — before
they ever appear on gmgn, DexScreener, or GeckoTerminal — and their
``frontend-api-v3`` REST API responds directly to a normal GET with a
browser UA. That's what this client wraps.

We consume:

    /coins?sort=created_timestamp&order=DESC&limit=N   — freshest N coins

Each coin gives us the on-chain mint address, symbol/name, description,
current usd market cap, bonding-curve progress, and creation timestamp,
which is exactly what the trader cortex needs to decide "should I even
look at this?".
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import List, Optional


LOG = logging.getLogger("market.pump_fun")


PUMPFUN_BASE = "https://frontend-api-v3.pump.fun"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)


@dataclass
class FreshCoin:
    """A freshly-created pump.fun token."""

    mint: str                         # on-chain token address (base58 on
                                      # solana; 0x… on evm-style chains)
    symbol: str
    name: str
    description: str
    created_timestamp_ms: int
    usd_market_cap: float
    complete: bool                    # True → graduated to Raydium
    king_of_the_hill_timestamp_ms: Optional[int]
    twitter: Optional[str]
    telegram: Optional[str]
    website: Optional[str]
    image_uri: Optional[str]
    chain: str = "solana"             # 'solana' | 'robinhood' | 'ethereum' | …
    raw: dict = field(default_factory=dict, repr=False)

    @classmethod
    def from_raw(cls, r: dict) -> "FreshCoin":
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

        koth = r.get("king_of_the_hill_timestamp")
        return cls(
            mint=(r.get("mint") or "").strip(),
            symbol=(r.get("symbol") or "").strip().upper()[:16],
            name=(r.get("name") or "").strip()[:80],
            description=(r.get("description") or "").strip()[:240],
            created_timestamp_ms=i(r.get("created_timestamp")),
            usd_market_cap=f(r.get("usd_market_cap")),
            complete=bool(r.get("complete")),
            king_of_the_hill_timestamp_ms=i(koth) if koth else None,
            twitter=r.get("twitter") or None,
            telegram=r.get("telegram") or None,
            website=r.get("website") or None,
            image_uri=r.get("image_uri") or None,
            raw=r,
        )

    @property
    def age_minutes(self) -> float:
        if not self.created_timestamp_ms:
            return 0.0
        return (time.time() * 1000 - self.created_timestamp_ms) / 60_000.0

    @property
    def is_fresh(self) -> bool:
        """< 6h old counts as 'fresh alpha'."""
        return self.age_minutes < 360

    @property
    def launchpad(self) -> str:
        """Best-effort launchpad tag (pump.fun / letsbonk / moonshot / …)."""
        if isinstance(self.raw, dict):
            src = self.raw.get("launchpad_source")
            if src:
                return src
        return "pump.fun"

    def to_public(self) -> dict:
        return {
            "mint": self.mint,
            "symbol": self.symbol,
            "name": self.name,
            "description": self.description[:120],
            "age_minutes": round(self.age_minutes, 1),
            "usd_market_cap": round(self.usd_market_cap, 2),
            "complete": self.complete,
            "king_of_the_hill": self.king_of_the_hill_timestamp_ms is not None,
            "twitter": self.twitter,
            "telegram": self.telegram,
            "website": self.website,
            "image_uri": self.image_uri,
            "launchpad": self.launchpad,
            "chain": self.chain,
        }


class PumpFunClient:
    """Very small async wrapper around pump.fun's frontend REST API."""

    def __init__(self, base: str = PUMPFUN_BASE, timeout: float = 10.0):
        self.base = base.rstrip("/")
        self.timeout = timeout

    def _get_sync(self, path: str, params: Optional[dict] = None):
        url = self.base + path
        if params:
            q = urllib.parse.urlencode(
                {k: v for k, v in params.items() if v is not None}
            )
            url = f"{url}?{q}"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "en-US,en;q=0.9",
                "Origin": "https://pump.fun",
                "Referer": "https://pump.fun/board",
            },
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))

    async def _get(self, path: str, params: Optional[dict] = None):
        return await asyncio.to_thread(self._get_sync, path, params)

    # ---------- high level ----------

    async def fresh_coins(self,
                          limit: int = 30,
                          include_nsfw: bool = False) -> List[FreshCoin]:
        """Latest N freshly-minted pump.fun coins, newest first."""
        try:
            data = await self._get(
                "/coins",
                {
                    "offset": 0,
                    "limit": limit,
                    "sort": "created_timestamp",
                    "order": "DESC",
                    "includeNsfw": "true" if include_nsfw else "false",
                },
            )
        except Exception as e:  # noqa: BLE001
            LOG.warning("pump.fun fresh_coins fetch failed: %s", e)
            return []
        if not isinstance(data, list):
            return []
        out: List[FreshCoin] = []
        for r in data:
            if not isinstance(r, dict):
                continue
            try:
                coin = FreshCoin.from_raw(r)
            except Exception:  # noqa: BLE001
                continue
            if not coin.mint:
                continue
            out.append(coin)
        return out

    async def near_graduation(self,
                              limit: int = 20,
                              include_nsfw: bool = False) -> List[FreshCoin]:
        """Coins closest to graduating to Raydium — the highest-conviction
        end of the fresh-launch spectrum."""
        try:
            data = await self._get(
                "/coins",
                {
                    "offset": 0,
                    "limit": limit,
                    "sort": "market_cap",
                    "order": "DESC",
                    "includeNsfw": "true" if include_nsfw else "false",
                    "complete": "false",
                },
            )
        except Exception as e:  # noqa: BLE001
            LOG.warning("pump.fun near_graduation fetch failed: %s", e)
            return []
        if not isinstance(data, list):
            return []
        return [FreshCoin.from_raw(r) for r in data if isinstance(r, dict)]
