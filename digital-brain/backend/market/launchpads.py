"""Multi-launchpad fresh-launch feed.

The user asked for the brain to hunt fresh launches on **all** Solana
launchpads — not just pump.fun. This module aggregates every launchpad we
can reach without a paid key or an authenticated session:

    * pump.fun          — direct REST (fresh + near-graduation / KOTH)
    * LetsBonk / bonk.fun — DexScreener search for `bonk.fun` / `letsbonk`
    * Believe / Clanker — DexScreener search for `believe`
    * Moonshot          — DexScreener search for `moonshot`
    * Jupiter Studio    — DexScreener search for `jup.studio`
    * Raydium LaunchLab — DexScreener token-boost list (curated Solana pool)

Every launchpad returns the same `FreshCoin` shape (see `pump_fun.py`),
tagged with a per-source `launchpad` string on `FreshCoin.raw`. Downstream
consumers treat all launchpads uniformly.

Design constraints:
    * No paid APIs, no auth.
    * Any launchpad that fails silently degrades — aggregator returns
      whatever succeeded.
    * De-duped by mint address across all sources; earliest-seen wins for
      metadata but we may merge in richer socials / description if a
      later feed carries them.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Dict, List, Optional, Tuple

from .dexscreener import DexScreenerClient, PairSnapshot
from .pump_fun import FreshCoin, PumpFunClient


LOG = logging.getLogger("market.launchpads")


LAUNCHPAD_HINTS = {
    "pump.fun":       ["pump.fun", "pumpfun", "pump-fun"],
    "letsbonk":       ["bonk.fun", "letsbonk", "let-us-bonk", "bonkfun"],
    "believe":        ["believe", "clanker"],
    "moonshot":       ["moonshot"],
    "jup-studio":     ["jup.studio", "jupiter studio", "jup-studio", "jup_studio"],
    "raydium":        ["raydium-launchlab", "launchlab", "raydium"],
    # Robinhood Chain (their new EVM-style L2). Tokens here are EVM
    # addresses (0x…) and typically launched via Uniswap-family DEXes.
    "robinhood-chain": ["robinhood", "robinhoodchain", "hoodchain"],
}


def _classify_launchpad(*hints: Optional[str]) -> str:
    joined = " ".join((h or "").lower() for h in hints)
    for pad, needles in LAUNCHPAD_HINTS.items():
        for n in needles:
            if n in joined:
                return pad
    return "unknown"


def launchpad_of(coin: FreshCoin) -> str:
    """Extract the launchpad tag stored on a FreshCoin (see MultiLaunchpadWatcher)."""
    if not coin.raw:
        return "unknown"
    return coin.raw.get("launchpad_source") or "unknown"


def _pair_to_fresh(p: PairSnapshot, launchpad: str) -> FreshCoin:
    raw = p.raw or {}
    info = raw.get("info") or {}
    socials = info.get("socials") or []
    twitter, telegram = None, None
    for s in socials:
        t = (s.get("type") or s.get("platform") or "").lower()
        u = s.get("url")
        if not u:
            continue
        if "twitter" in t or "x.com" in u:
            twitter = twitter or u
        elif "telegram" in t or "t.me" in u:
            telegram = telegram or u
    websites = info.get("websites") or []
    website = None
    for w in websites:
        if isinstance(w, dict) and w.get("url"):
            website = w["url"]
            break
        if isinstance(w, str):
            website = w
            break
    image = info.get("imageUrl") or None
    base = raw.get("baseToken") or {}
    name = (base.get("name") or p.base_symbol or "")[:80]

    return FreshCoin(
        mint=p.base_address,
        symbol=(p.base_symbol or "").upper()[:16],
        name=name,
        description="",
        created_timestamp_ms=int(p.pair_created_at_ms or 0),
        usd_market_cap=float(p.market_cap or p.fdv or 0.0),
        complete=False,
        king_of_the_hill_timestamp_ms=None,
        twitter=twitter,
        telegram=telegram,
        website=website,
        image_uri=image,
        chain=(p.chain or "solana"),
        raw={"launchpad_source": launchpad, "pair": raw},
    )


class MultiLaunchpadWatcher:
    """Aggregates fresh launches across every Solana launchpad we can reach."""

    def __init__(self,
                 dex: Optional[DexScreenerClient] = None,
                 pumpfun: Optional[PumpFunClient] = None):
        self.dex = dex or DexScreenerClient()
        self.pumpfun = pumpfun or PumpFunClient()

    # ------------------------------------------------------------------
    async def all_fresh(self, per_source_limit: int = 30) -> Tuple[List[FreshCoin], Dict[str, int]]:
        """Fetch fresh launches across every launchpad. Returns (coins, per-source-counts)."""
        tasks = [
            self._pumpfun_fresh(per_source_limit),
            self._pumpfun_koth(),
            self._dex_search("bonk.fun",  per_source_limit, default_pad="letsbonk"),
            self._dex_search("letsbonk",  per_source_limit, default_pad="letsbonk"),
            self._dex_search("believe",   per_source_limit, default_pad="believe"),
            self._dex_search("moonshot",  per_source_limit, default_pad="moonshot"),
            self._dex_search("jup.studio", per_source_limit, default_pad="jup-studio"),
            self._dex_boosted(),
            self._dex_profiles(),
            # Robinhood Chain — their brand-new EVM-style L2. The API
            # exposes it as chainId="robinhood"; we hunt trending token
            # names and DexScreener's chain-agnostic boosted/profile
            # feeds and keep whichever ones landed on that chain.
            self._robinhood_chain_boosted(),
            self._robinhood_chain_profiles(),
            self._robinhood_chain_search("uniswap", per_source_limit),
            self._robinhood_chain_search("meme", per_source_limit),
            self._robinhood_chain_search("robinhood", per_source_limit),
            # Named-symbol probes. DexScreener's search endpoint returns
            # every matching pair across every chain, so probing for
            # well-known Robinhood-chain top-movers (whose names we
            # know) reliably surfaces them even when they're not in
            # boosted / profiles. Add more as the chain matures.
            self._robinhood_chain_search("PONS", per_source_limit),
            self._robinhood_chain_search("LONG", per_source_limit),
            self._robinhood_chain_search("HOOD", per_source_limit),
        ]
        results: List[Tuple[str, List[FreshCoin]]] = []
        gathered = await asyncio.gather(*tasks, return_exceptions=True)
        for r in gathered:
            if isinstance(r, Exception):
                LOG.debug("launchpad source failed: %s", r)
                continue
            results.append(r)

        by_mint: Dict[str, FreshCoin] = {}
        for _src, coins in results:
            for c in coins:
                if not c.mint:
                    continue
                prev = by_mint.get(c.mint)
                if prev is None:
                    by_mint[c.mint] = c
                    continue
                # Merge in richer metadata from a secondary source.
                if not prev.description and c.description:
                    prev.description = c.description
                if not prev.image_uri and c.image_uri:
                    prev.image_uri = c.image_uri
                if not prev.twitter and c.twitter:
                    prev.twitter = c.twitter
                if not prev.telegram and c.telegram:
                    prev.telegram = c.telegram
                if not prev.website and c.website:
                    prev.website = c.website
                if (not prev.usd_market_cap) and c.usd_market_cap:
                    prev.usd_market_cap = c.usd_market_cap

        source_counts: Dict[str, int] = {}
        for src, coins in results:
            source_counts[src] = len(coins)

        merged = list(by_mint.values())
        merged.sort(key=lambda c: c.created_timestamp_ms or 0, reverse=True)
        return merged, source_counts

    # ------------------------------------------------------------------
    # Source fetchers. Each returns (source_name, [FreshCoin]).
    # ------------------------------------------------------------------
    async def _pumpfun_fresh(self, limit: int) -> Tuple[str, List[FreshCoin]]:
        try:
            coins = await self.pumpfun.fresh_coins(limit=limit)
        except Exception:  # noqa: BLE001
            return "pump.fun", []
        for c in coins:
            c.raw = c.raw or {}
            c.raw["launchpad_source"] = "pump.fun"
        return "pump.fun", coins

    async def _pumpfun_koth(self) -> Tuple[str, List[FreshCoin]]:
        try:
            coins = await self.pumpfun.near_graduation(limit=15)
        except Exception:  # noqa: BLE001
            return "pump.fun-koth", []
        for c in coins:
            c.raw = c.raw or {}
            c.raw["launchpad_source"] = "pump.fun"
        return "pump.fun-koth", coins

    async def _dex_search(self, query: str, limit: int,
                          default_pad: str) -> Tuple[str, List[FreshCoin]]:
        try:
            pairs = await self.dex.search_pairs(query)
        except Exception:  # noqa: BLE001
            return default_pad, []
        best_per_base: Dict[str, PairSnapshot] = {}
        for p in pairs:
            if p.chain != "solana":
                continue
            key = p.base_address or p.pair_address
            prev = best_per_base.get(key)
            if prev is None or p.liquidity_usd > prev.liquidity_usd:
                best_per_base[key] = p
        coins: List[FreshCoin] = []
        for p in list(best_per_base.values())[:limit]:
            labels = " ".join((p.raw or {}).get("labels") or [])
            pad = _classify_launchpad(p.dex, p.url, labels)
            if pad == "unknown":
                pad = default_pad
            coins.append(_pair_to_fresh(p, pad))
        return default_pad, coins

    async def _dex_boosted(self) -> Tuple[str, List[FreshCoin]]:
        try:
            boosted = await self.dex.token_boosts_top()
        except Exception:  # noqa: BLE001
            return "raydium", []
        addrs = [t["tokenAddress"] for t in boosted
                 if t.get("chainId") == "solana" and t.get("tokenAddress")]
        if not addrs:
            return "raydium", []
        addrs = addrs[:30]
        try:
            pairs = await self.dex.tokens("solana", addrs)
        except Exception:  # noqa: BLE001
            return "raydium", []
        coins: List[FreshCoin] = []
        seen = set()
        for p in pairs:
            if not p.base_address or p.base_address in seen:
                continue
            seen.add(p.base_address)
            labels = " ".join((p.raw or {}).get("labels") or [])
            pad = _classify_launchpad(p.dex, p.url, labels)
            if pad == "unknown":
                pad = "raydium"
            coins.append(_pair_to_fresh(p, pad))
        return "raydium", coins

    async def _dex_profiles(self) -> Tuple[str, List[FreshCoin]]:
        try:
            profiles = await self.dex.token_profiles_latest()
        except Exception:  # noqa: BLE001
            return "dexscreener", []
        addrs = [t["tokenAddress"] for t in profiles
                 if t.get("chainId") == "solana" and t.get("tokenAddress")]
        if not addrs:
            return "dexscreener", []
        addrs = addrs[:30]
        try:
            pairs = await self.dex.tokens("solana", addrs)
        except Exception:  # noqa: BLE001
            return "dexscreener", []
        coins: List[FreshCoin] = []
        seen = set()
        for p in pairs:
            if not p.base_address or p.base_address in seen:
                continue
            seen.add(p.base_address)
            labels = " ".join((p.raw or {}).get("labels") or [])
            pad = _classify_launchpad(p.dex, p.url, labels)
            if pad == "unknown":
                pad = "dexscreener"
            coins.append(_pair_to_fresh(p, pad))
        return "dexscreener", coins

    # ---------- Robinhood Chain ----------
    # Robinhood's new EVM-style L2 shows up in DexScreener as
    # chainId="robinhood". These sources hunt for real launches on
    # that chain (top-cap tokens like $PONS live here — $400M mcap).
    async def _robinhood_chain_boosted(self) -> Tuple[str, List[FreshCoin]]:
        try:
            boosted = await self.dex.token_boosts_top()
        except Exception:  # noqa: BLE001
            return "robinhood-chain-boosted", []
        addrs = [t["tokenAddress"] for t in boosted
                 if t.get("chainId") == "robinhood" and t.get("tokenAddress")]
        if not addrs:
            return "robinhood-chain-boosted", []
        addrs = addrs[:30]
        try:
            pairs = await self.dex.tokens("robinhood", addrs)
        except Exception:  # noqa: BLE001
            return "robinhood-chain-boosted", []
        return "robinhood-chain-boosted", self._pairs_to_coins(
            pairs, "robinhood", default_pad="robinhood-chain",
        )

    async def _robinhood_chain_profiles(self) -> Tuple[str, List[FreshCoin]]:
        try:
            profiles = await self.dex.token_profiles_latest()
        except Exception:  # noqa: BLE001
            return "robinhood-chain-profiles", []
        addrs = [t["tokenAddress"] for t in profiles
                 if t.get("chainId") == "robinhood" and t.get("tokenAddress")]
        if not addrs:
            return "robinhood-chain-profiles", []
        addrs = addrs[:30]
        try:
            pairs = await self.dex.tokens("robinhood", addrs)
        except Exception:  # noqa: BLE001
            return "robinhood-chain-profiles", []
        return "robinhood-chain-profiles", self._pairs_to_coins(
            pairs, "robinhood", default_pad="robinhood-chain",
        )

    async def _robinhood_chain_search(self, query: str,
                                      limit: int) -> Tuple[str, List[FreshCoin]]:
        """DexScreener's search endpoint is chain-agnostic — filter it
        for chainId=='robinhood' to pull real Robinhood-Chain pairs."""
        try:
            pairs = await self.dex.search_pairs(query)
        except Exception:  # noqa: BLE001
            return f"robinhood-chain::{query}", []
        best: Dict[str, PairSnapshot] = {}
        for p in pairs:
            if p.chain != "robinhood":
                continue
            key = p.base_address or p.pair_address
            prev = best.get(key)
            if prev is None or p.liquidity_usd > prev.liquidity_usd:
                best[key] = p
        return f"robinhood-chain::{query}", self._pairs_to_coins(
            list(best.values())[:limit], "robinhood",
            default_pad="robinhood-chain",
        )

    # ---------- helpers ----------
    @staticmethod
    def _pairs_to_coins(pairs: List[PairSnapshot], expected_chain: str,
                        default_pad: str) -> List[FreshCoin]:
        coins: List[FreshCoin] = []
        seen: set = set()
        for p in pairs:
            if not p.base_address or p.base_address in seen:
                continue
            if expected_chain and p.chain != expected_chain:
                continue
            seen.add(p.base_address)
            labels = " ".join((p.raw or {}).get("labels") or [])
            pad = _classify_launchpad(p.dex, p.url, labels)
            if pad == "unknown":
                pad = default_pad
            coins.append(_pair_to_fresh(p, pad))
        return coins
