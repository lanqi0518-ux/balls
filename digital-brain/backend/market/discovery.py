"""Auto-discovery of promising Solana trader wallets.

For each pumping hot token in the trending list we:

  1. Take the DEX pool address (``pair_address`` from DexScreener — this
     is the on-chain pool account that every swap on this token routes
     through).
  2. Call Solana RPC ``getSignaturesForAddress(pair_address, {limit: N})``
     to fetch the most recent successful signatures touching that pool.
     Every one of those signatures is a swap.
  3. For a subset of those signatures, call ``getTransaction`` and read
     the fee-payer wallet + the token balance delta. The fee-payer of a
     swap tx is (almost always) the wallet that actually executed the
     swap.
  4. Rank the swapper wallets we saw by activity count on this pool,
     drop known AMM / DEX / CEX / burn / program addresses, and return
     the remaining ones as candidate smart-money traders.

This is a from-scratch equivalent of the ``smart money`` tabs on gmgn.ai
(which blocks our IP at Cloudflare). It also gives us fresh candidates
every cycle — the recent-swappers list rotates constantly.

Nothing here fabricates data — every discovered address comes from a
real ``getTransaction`` reply for a real successful swap on a real
Solana pool that DexScreener currently lists as pumping.

Note: we deliberately do NOT call ``getTokenLargestAccounts`` — most
public Solana RPCs either block that method entirely ("Request blocked")
or rate-limit it aggressively (it's a full index scan). Recent-swappers
via signatures is both cheaper and better — a diamond-handed holder
isn't the trader we want to imitate; an active swapper is.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Set, Tuple

from .dexscreener import PairSnapshot


LOG = logging.getLogger("market.discovery")


# We rotate through several public Solana RPCs to survive their rate limits.
# The order is significant: publicnode + ankr generally give higher free-tier
# throughput than the official ``mainnet-beta`` endpoint, which we keep as a
# last-resort fallback.
DEFAULT_RPC_POOL = [
    "https://solana-rpc.publicnode.com",
    "https://rpc.ankr.com/solana",
    "https://solana.drpc.org",
    "https://api.mainnet-beta.solana.com",
]

DEFAULT_RPC = DEFAULT_RPC_POOL[0]


# --- Deny-list ---------------------------------------------------------
#
# Addresses that *own* a lot of SPL tokens but are NOT retail traders.
# The classes are:
#   - Solana core programs (System, SPL Token, Associated Token, …)
#   - Common AMM / DEX programs (Raydium, Orca, Meteora, Lifinity, …)
#   - Aggregator programs (Jupiter, OKX DEX, …)
#   - Perps / lending vaults (MarginFi, Marinade, Kamino, …)
#   - Known CEX deposit / hot wallets (Binance, OKX, Coinbase, Kraken, Bybit)
#   - Well-known burn addresses
#
# We're not trying to catch every LP; the goal is to keep obvious pool
# vaults and exchange hot wallets out of the "trader" list. Anything else
# gets a chance and will be pruned later if it turns out to be dead
# weight (see the auto-prune loop in TradingService).

_SOLANA_SYSTEM = {
    "11111111111111111111111111111111",
    "So11111111111111111111111111111111111111112",
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    "SysvarRent111111111111111111111111111111111",
    "SysvarC1ock11111111111111111111111111111111",
    "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    "ComputeBudget111111111111111111111111111111",
}

_BURN_ADDRESSES = {
    "1nc1nerator11111111111111111111111111111111",
    "burnbNsWiSj9GMBoY9dLxYwbjeF2X7uzsFmp3XDPqSj",  # placeholder pattern
    "deadDeadDeadDeadDeadDeadDeadDeadDeadDead111",
}

_AMM_AND_DEX = {
    # Raydium
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",     # AMM v4
    "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",     # AMM authority
    "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",     # CLMM
    "27haf8L6oxUeXrHrgEgsexjSY5hbVUWEmvv9Nyxg8vQv",     # CPMM
    # Orca
    "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",     # Orca v1 program
    "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",     # Whirlpool
    # Meteora
    "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",     # DLMM
    "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB",     # Dynamic AMM
    # Lifinity
    "EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S",
    # Phoenix
    "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY",
    # OpenBook / Serum
    "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX",
    "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb",     # OpenBook v2
    # Jupiter
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
    "JUP2jxvXaqu7NQY1GmNF4m1vodw12LVXYxbFL2uJvfo",
    "JUPPPUqrDLJ7Y4gDxSwR7yGQ6EX7g5V6b6DTiuKZoAP",
    # Pump.fun
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
    "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
    # Meteora vaults
    "24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi",
    # Marinade / Solend / Kamino / MarginFi
    "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",
    "So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo",
    "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
    "MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA",
}

_CEX_HOT_WALLETS = {
    # Binance
    "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S",
    # OKX
    "CEZN7VPqDBRfNCwrJPZaeKuomcarASNiPBQ56L7gFXbz",
    "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE",
    "5VCwKtCXgCJ6kit5FybXjvriW3xELsFDhYrPSqtJNmcD",
    # Coinbase
    "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS",
    "9Gpp1x7ZTUvpDGnvL9AwbSXypBUwvR2NNDaEbbUmyAJp",
    # Kraken
    "3gd3dqgtJ4jWfBfLYTX67DALFetjc5iS72sCgRhCkW2u",
    # Bybit
    "AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2",
    "42brAgAVNzMBP7aaktPvAmBSPEkehnFQejiZc53EpJFb",
    # KuCoin
    "BmFdpraQhkiDQE6SnfG5omcA1VwzqfXrwtNYBwWTymy6",
    # MEXC
    "AobVSwdW9BbpMdJvTqeCN4hPAmh4rHm7vwLnQ5ATSyrS",
    # Gate.io
    "u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w",
}

DENY_OWNERS: Set[str] = (
    _SOLANA_SYSTEM
    | _BURN_ADDRESSES
    | _AMM_AND_DEX
    | _CEX_HOT_WALLETS
)


# ---------------------------------------------------------------------


@dataclass
class DiscoveredWallet:
    """One candidate wallet found by scanning a hot token's recent swaps."""

    wallet: str
    source_token_symbol: str
    source_token_mint: str
    source_token_pump_pct_24h: float
    swap_count_observed: int
    discovered_at_s: float


class WalletDiscovery:
    """Runs periodic on-chain scans that turn pumping tokens into a stream
    of candidate trader wallets."""

    def __init__(
        self,
        rpc_url: Optional[str] = None,
        rpc_pool: Optional[List[str]] = None,
        scan_interval: float = 180.0,
        min_pump_pct_24h: float = 25.0,
        min_liquidity_usd: float = 50_000.0,
        max_tokens_per_scan: int = 4,
        signatures_per_token: int = 30,
        tx_fetches_per_token: int = 12,
        min_swap_sol: float = 0.05,
        target_tracked: int = 20,
    ):
        pool = list(rpc_pool or DEFAULT_RPC_POOL)
        if rpc_url and rpc_url not in pool:
            pool.insert(0, rpc_url)
        self.rpc_pool: List[str] = pool
        self.rpc_url: str = pool[0]  # kept for backward-compat / debugging
        self._rpc_idx: int = 0
        self.scan_interval = scan_interval
        self.min_pump_pct_24h = min_pump_pct_24h
        self.min_liquidity_usd = min_liquidity_usd
        self.max_tokens_per_scan = max_tokens_per_scan
        self.signatures_per_token = signatures_per_token
        self.tx_fetches_per_token = tx_fetches_per_token
        self.min_swap_sol = min_swap_sol
        self.target_tracked = target_tracked
        self._seen_wallets: Set[str] = set()
        self._last_scan_at: float = 0.0
        self._last_added: List[DiscoveredWallet] = []

    # ------------------------------------------------------------------

    def status(self) -> dict:
        return {
            "scan_interval": self.scan_interval,
            "last_scan_ms": int(self._last_scan_at * 1000) if self._last_scan_at else 0,
            "seen_wallet_count": len(self._seen_wallets),
            "target_tracked": self.target_tracked,
            "rpc_pool_size": len(self.rpc_pool),
            "current_rpc": self.rpc_pool[self._rpc_idx],
            "recent_discoveries": [
                {
                    "wallet": d.wallet,
                    "source_symbol": d.source_token_symbol,
                    "pump_pct_24h": round(d.source_token_pump_pct_24h, 1),
                    "at_ms": int(d.discovered_at_s * 1000),
                }
                for d in self._last_added[-30:]
            ],
        }

    # ------------------------------------------------------------------

    async def scan(
        self,
        hot_tokens: List[PairSnapshot],
        already_tracked: Set[str],
    ) -> List[DiscoveredWallet]:
        """Discover candidate wallets from top holders of pumping tokens.

        Returns only wallets that are NEW (not in ``already_tracked`` and
        not previously returned by this instance).
        """
        self._last_scan_at = time.time()

        # Pick pumping, liquid tokens; skip those we already scanned recently.
        qualifying = [
            p for p in hot_tokens
            if p.liquidity_usd >= self.min_liquidity_usd
            and (p.price_change_h24 or 0) >= self.min_pump_pct_24h
            and p.base_address
        ]
        # Prefer bigger pumps first.
        qualifying.sort(key=lambda p: p.price_change_h24 or 0, reverse=True)
        qualifying = qualifying[: self.max_tokens_per_scan]
        if not qualifying:
            LOG.debug("no qualifying pump tokens to scan")
            return []

        discovered: List[DiscoveredWallet] = []
        for pair in qualifying:
            try:
                candidates = await self._scan_one_token(pair, already_tracked)
            except Exception as e:  # noqa: BLE001
                LOG.warning("scan of %s failed: %s", pair.base_symbol, e)
                continue
            for c in candidates:
                if c.wallet in self._seen_wallets:
                    continue
                if c.wallet in already_tracked:
                    continue
                self._seen_wallets.add(c.wallet)
                discovered.append(c)
            # Space out per-token scans so the public RPC doesn't 429 us.
            await asyncio.sleep(1.5)

        self._last_added = discovered
        LOG.info(
            "discovery scanned %d tokens, produced %d new candidate wallets",
            len(qualifying), len(discovered),
        )
        return discovered

    # ------------------------------------------------------------------

    async def _scan_one_token(
        self, pair: PairSnapshot, already_tracked: Set[str],
    ) -> List[DiscoveredWallet]:
        """For one hot token, pull recent swap signatures on its pool
        address and extract the swapper wallets from each transaction."""
        pool_addr = pair.pair_address
        if not pool_addr:
            return []
        sigs = await self._rpc("getSignaturesForAddress", [
            pool_addr, {"limit": self.signatures_per_token},
        ])
        if not isinstance(sigs, list):
            return []
        # Keep only successful signatures (drop failed txns).
        sigs = [s for s in sigs if s and s.get("signature") and not s.get("err")]
        if not sigs:
            return []
        # Pick the freshest N to actually fetch — trades most recently.
        # (Signatures come back newest-first.)
        sigs = sigs[: self.tx_fetches_per_token]

        counts: Dict[str, int] = {}     # wallet -> observed swap count
        for sinfo in sigs:
            sig = sinfo.get("signature")
            if not sig:
                continue
            try:
                tx = await self._rpc("getTransaction", [
                    sig,
                    {"encoding": "jsonParsed",
                     "maxSupportedTransactionVersion": 0,
                     "commitment": "confirmed"},
                ])
            except Exception as e:  # noqa: BLE001
                LOG.debug("getTransaction %s failed: %s", sig[:8], e)
                await asyncio.sleep(0.4)
                continue
            if not tx:
                continue
            swapper = self._extract_swapper(tx, pair.base_address)
            if not swapper:
                continue
            if swapper in DENY_OWNERS:
                continue
            counts[swapper] = counts.get(swapper, 0) + 1
            await asyncio.sleep(0.15)  # RPC pacing

        # Rank swappers by observed count, keep the most active.
        ranked = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)

        out: List[DiscoveredWallet] = []
        for wallet, cnt in ranked:
            if wallet in already_tracked or wallet in self._seen_wallets:
                continue
            out.append(DiscoveredWallet(
                wallet=wallet,
                source_token_symbol=pair.base_symbol or "?",
                source_token_mint=pair.base_address,
                source_token_pump_pct_24h=float(pair.price_change_h24 or 0.0),
                swap_count_observed=cnt,
                discovered_at_s=time.time(),
            ))
        return out

    # ------------------------------------------------------------------

    def _extract_swapper(self, tx: dict, mint: str) -> Optional[str]:
        """Return the wallet that most likely executed this swap.

        Heuristic:
          1. Take the transaction fee-payer (accountKeys[0], always the
             signer paying fees) — for the vast majority of Solana swaps
             (Jupiter, Raydium direct, Pump.fun, Orca) this IS the user's
             wallet.
          2. Verify that same wallet had a non-zero SOL delta *and*
             appears in preTokenBalances / postTokenBalances for the
             target mint (i.e. actually swapped this token, not merely
             touched the pool). If neither check succeeds, skip.
        """
        try:
            meta = tx.get("meta") or {}
            if meta.get("err"):
                return None
            tr = tx.get("transaction") or {}
            msg = tr.get("message") or {}
            keys = msg.get("accountKeys") or []
            if not keys:
                return None
            first = keys[0]
            fee_payer = first.get("pubkey") if isinstance(first, dict) else first
            if not fee_payer:
                return None

            # SOL delta on the fee-payer
            pre = (meta.get("preBalances") or [])
            post = (meta.get("postBalances") or [])
            if not pre or not post:
                sol_delta = 0.0
            else:
                sol_delta = (post[0] - pre[0]) / 1_000_000_000

            # Did this wallet also own a token account for the target mint?
            touched_mint = False
            for tb in (meta.get("preTokenBalances") or []) + (meta.get("postTokenBalances") or []):
                if tb.get("owner") == fee_payer and tb.get("mint") == mint:
                    touched_mint = True
                    break

            # Require either a real SOL move (>= min_swap_sol) or token-account
            # activity on the target mint. This filters out MEV searchers that
            # sandwich the pool without themselves swapping the token.
            if abs(sol_delta) < self.min_swap_sol and not touched_mint:
                return None
            return fee_payer
        except (AttributeError, TypeError, KeyError, IndexError):
            return None

    # ------------------------------------------------------------------

    async def _rpc(self, method: str, params: list) -> object:
        """Try each RPC in the pool until one responds. Rotates on 429/5xx."""
        body_bytes = json.dumps({
            "jsonrpc": "2.0", "id": 1, "method": method, "params": params,
        }).encode("utf-8")

        last_err: Optional[Exception] = None
        for attempt in range(len(self.rpc_pool)):
            url = self.rpc_pool[self._rpc_idx]
            req = urllib.request.Request(
                url, data=body_bytes,
                headers={
                    "content-type": "application/json",
                    "user-agent": "digital-brain/discovery",
                },
                method="POST",
            )

            def blocking():
                with urllib.request.urlopen(req, timeout=20) as r:
                    return json.loads(r.read().decode("utf-8"))

            try:
                data = await asyncio.to_thread(blocking)
                if isinstance(data, dict) and data.get("error"):
                    raise RuntimeError(f"rpc error {data['error']} from {url}")
                return (data or {}).get("result")
            except urllib.error.HTTPError as e:
                last_err = e
                LOG.debug("rpc %s → %s HTTP %s", method, url, e.code)
                if e.code in (429, 500, 502, 503, 504):
                    # rotate to next endpoint
                    self._rpc_idx = (self._rpc_idx + 1) % len(self.rpc_pool)
                    self.rpc_url = self.rpc_pool[self._rpc_idx]
                    await asyncio.sleep(0.8)
                    continue
                raise
            except (urllib.error.URLError, TimeoutError, RuntimeError) as e:
                last_err = e
                LOG.debug("rpc %s → %s failed: %s", method, url, e)
                self._rpc_idx = (self._rpc_idx + 1) % len(self.rpc_pool)
                self.rpc_url = self.rpc_pool[self._rpc_idx]
                await asyncio.sleep(0.5)
                continue

        if last_err:
            raise last_err
        return None
