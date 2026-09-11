"""Wallet activity tracker on Solana.

For each tracked wallet address we poll the public Solana RPC every
``poll_interval`` seconds for new signatures, then fetch each new tx and
try to classify it as a *buy* or *sell* of some SPL token in exchange for
SOL (or a stablecoin).

Because parsing arbitrary Solana transactions is a full-time job (Jupiter
routes, aggregators, wrappers), we take a pragmatic shortcut: we compute
the wallet's SOL balance delta and its SPL token balance deltas from the
transaction's ``preBalances`` / ``postBalances`` / ``preTokenBalances`` /
``postTokenBalances`` fields. If SOL decreased and exactly one SPL token
increased, we call that a **buy** of that token. The mirror case is a
**sell**. Everything else is ignored (transfers, stake ops, NFTs, etc.).

Rate-limits are a concern with the public RPC; we back off automatically
on 429 and 5xx.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional


LOG = logging.getLogger("market.wallets")

DEFAULT_RPC = "https://api.mainnet-beta.solana.com"

SOL_MINT = "So11111111111111111111111111111111111111112"
STABLE_MINTS = {
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",  # USDT
}


@dataclass
class TrackedTrade:
    wallet: str
    signature: str
    slot: int
    block_time: int          # unix seconds
    side: str                # "buy" or "sell"
    token_mint: str          # SPL mint
    token_symbol: Optional[str]  # filled by TokenSymbolResolver upstream if desired
    token_amount: float      # SPL token amount (ui-adjusted for decimals)
    sol_amount: float        # SOL delta (positive value; direction encoded in ``side``)
    stable_amount: float     # if paired with a stablecoin instead of SOL
    price_native: float      # SOL per token (or 0 if stable-paid)
    price_usd_est: float     # rough USD price = sol_amount * sol_usd / token_amount

    def to_public(self) -> dict:
        return asdict(self)


class WalletWatcher:
    def __init__(self,
                 rpc_url: str = DEFAULT_RPC,
                 poll_interval: float = 20.0,
                 lookback_signatures: int = 15):
        self.rpc_url = rpc_url
        self.poll_interval = poll_interval
        self.lookback_signatures = lookback_signatures
        self._wallets: Dict[str, dict] = {}    # wallet -> {last_signatures: set, added_at}
        self._trades: List[TrackedTrade] = []  # rolling recent trades (all wallets)
        self._trades_by_wallet: Dict[str, List[TrackedTrade]] = {}
        self._max_recent = 300
        self._max_per_wallet = 60
        self._task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()
        self._sol_usd: float = 150.0
        self._sol_usd_at: float = 0.0

    # ------------------------------------------------------------------

    def track(self, wallet: str, label: Optional[str] = None) -> None:
        wallet = (wallet or "").strip()
        if not wallet or len(wallet) < 32:
            return
        if wallet in self._wallets:
            return
        self._wallets[wallet] = {
            "last_signatures": set(),
            "added_at": time.time(),
            "label": label or "",
            "primed": False,
        }
        self._trades_by_wallet.setdefault(wallet, [])
        LOG.info("wallet tracked: %s (%s)", wallet[:6] + "…", label or "-")

    def untrack(self, wallet: str) -> None:
        self._wallets.pop(wallet, None)

    def wallets(self) -> List[str]:
        return list(self._wallets.keys())

    def wallets_public(self) -> List[dict]:
        out = []
        for w, meta in self._wallets.items():
            recent = self._trades_by_wallet.get(w, [])
            out.append({
                "wallet": w,
                "label": meta.get("label") or "",
                "added_at_ms": int(meta.get("added_at", 0) * 1000),
                "recent_trade_count": len(recent),
                "last_trade_time": (max(t.block_time for t in recent) if recent else 0),
            })
        return out

    def recent_trades(self, limit: int = 40) -> List[TrackedTrade]:
        return list(self._trades[-limit:])

    def recent_trades_public(self, limit: int = 40) -> List[dict]:
        return [t.to_public() for t in self.recent_trades(limit)]

    def trades_of(self, wallet: str, limit: int = 20) -> List[TrackedTrade]:
        return list(self._trades_by_wallet.get(wallet, [])[-limit:])

    def set_sol_usd(self, price: float) -> None:
        if price and price > 0:
            self._sol_usd = float(price)
            self._sol_usd_at = time.time()

    def status(self) -> dict:
        return {
            "wallets": len(self._wallets),
            "recent_trades": len(self._trades),
            "sol_usd": round(self._sol_usd, 4),
            "sol_usd_age_s": round(time.time() - self._sol_usd_at, 1) if self._sol_usd_at else -1,
        }

    # ------------------------------------------------------------------

    async def start(self) -> None:
        if self._task is None:
            self._stop.clear()
            self._task = asyncio.create_task(self._loop(), name="wallet-watcher")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None

    async def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                await self._tick()
            except Exception as e:  # noqa: BLE001
                LOG.warning("wallet tick failed: %s", e)
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.poll_interval)
            except asyncio.TimeoutError:
                pass

    # ------------------------------------------------------------------

    async def _tick(self) -> None:
        wallets = list(self._wallets.keys())
        for w in wallets:
            try:
                await self._poll_wallet(w)
            except Exception as e:  # noqa: BLE001
                LOG.warning("poll wallet %s failed: %s", w[:6], e)
            await asyncio.sleep(0.35)  # gentle on public RPC

    async def _poll_wallet(self, wallet: str) -> None:
        meta = self._wallets.get(wallet)
        if not meta:
            return
        sigs = await self._rpc("getSignaturesForAddress", [
            wallet, {"limit": self.lookback_signatures}
        ])
        if not isinstance(sigs, list):
            return

        seen = meta["last_signatures"]
        primed = meta["primed"]
        new_infos = [s for s in sigs if s.get("signature") and s["signature"] not in seen]

        # first poll ever — mark all as seen without fetching txns
        if not primed:
            for s in sigs:
                if s.get("signature"):
                    seen.add(s["signature"])
            meta["primed"] = True
            return

        # Fetch new txs oldest-first so trade list order makes sense.
        for s in reversed(new_infos):
            sig = s.get("signature")
            if not sig:
                continue
            try:
                tx = await self._rpc("getTransaction", [
                    sig,
                    {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0},
                ])
            except Exception as e:  # noqa: BLE001
                LOG.debug("getTransaction %s failed: %s", sig[:8], e)
                continue
            seen.add(sig)
            if not tx:
                continue
            parsed = self._parse_swap(wallet, tx)
            if parsed:
                self._trades.append(parsed)
                if len(self._trades) > self._max_recent:
                    self._trades[:] = self._trades[-self._max_recent:]
                per = self._trades_by_wallet.setdefault(wallet, [])
                per.append(parsed)
                if len(per) > self._max_per_wallet:
                    per[:] = per[-self._max_per_wallet:]

        # Cap the "seen" set so it doesn't grow unbounded.
        if len(seen) > 400:
            keep = {s["signature"] for s in sigs if s.get("signature")}
            meta["last_signatures"] = keep

    async def _rpc(self, method: str, params: list) -> object:
        body = json.dumps({
            "jsonrpc": "2.0", "id": 1, "method": method, "params": params,
        }).encode("utf-8")
        req = urllib.request.Request(
            self.rpc_url, data=body,
            headers={"content-type": "application/json"},
            method="POST",
        )

        def blocking():
            try:
                with urllib.request.urlopen(req, timeout=15) as r:
                    data = json.loads(r.read().decode("utf-8"))
                return data.get("result")
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    time.sleep(1.5)
                raise

        return await asyncio.to_thread(blocking)

    # ------------------------------------------------------------------

    def _parse_swap(self, wallet: str, tx: dict) -> Optional[TrackedTrade]:
        """Classify a tx as a buy/sell/skip based on balance deltas."""
        try:
            meta = tx.get("meta") or {}
            if meta.get("err"):
                return None
            slot = tx.get("slot") or 0
            block_time = tx.get("blockTime") or int(time.time())

            account_keys = self._account_keys(tx)
            if not account_keys:
                return None
            try:
                wallet_idx = account_keys.index(wallet)
            except ValueError:
                return None

            pre = meta.get("preBalances") or []
            post = meta.get("postBalances") or []
            if wallet_idx >= len(pre) or wallet_idx >= len(post):
                return None
            sol_delta_lamports = post[wallet_idx] - pre[wallet_idx]
            sol_delta = sol_delta_lamports / 1_000_000_000

            pre_tk = meta.get("preTokenBalances") or []
            post_tk = meta.get("postTokenBalances") or []
            deltas: Dict[str, float] = {}
            for tb in post_tk:
                if tb.get("owner") != wallet:
                    continue
                mint = tb.get("mint")
                if not mint:
                    continue
                amt = float((tb.get("uiTokenAmount") or {}).get("uiAmount") or 0)
                deltas[mint] = deltas.get(mint, 0.0) + amt
            for tb in pre_tk:
                if tb.get("owner") != wallet:
                    continue
                mint = tb.get("mint")
                if not mint:
                    continue
                amt = float((tb.get("uiTokenAmount") or {}).get("uiAmount") or 0)
                deltas[mint] = deltas.get(mint, 0.0) - amt

            # Ignore SOL mint token account deltas that mirror the native SOL delta.
            deltas.pop(SOL_MINT, None)

            non_zero = {m: d for m, d in deltas.items() if abs(d) > 1e-9}
            stable_delta = sum(v for m, v in non_zero.items() if m in STABLE_MINTS)
            spl_deltas = {m: d for m, d in non_zero.items() if m not in STABLE_MINTS}

            if not spl_deltas:
                return None

            # Pick the single largest SPL delta by absolute value.
            top_mint, top_delta = max(spl_deltas.items(), key=lambda kv: abs(kv[1]))
            if abs(top_delta) < 1e-9:
                return None

            side: str
            if top_delta > 0 and (sol_delta < -0.005 or stable_delta < -0.5):
                side = "buy"
            elif top_delta < 0 and (sol_delta > 0.005 or stable_delta > 0.5):
                side = "sell"
            else:
                return None

            sol_amount = abs(sol_delta) - 0.00001
            stable_amount = abs(stable_delta)
            price_native = 0.0
            price_usd = 0.0
            if sol_amount > 0.001 and abs(top_delta) > 0:
                price_native = sol_amount / abs(top_delta)
                price_usd = price_native * self._sol_usd
            elif stable_amount > 0.5 and abs(top_delta) > 0:
                price_usd = stable_amount / abs(top_delta)

            return TrackedTrade(
                wallet=wallet,
                signature=(tx.get("transaction", {}).get("signatures") or [""])[0],
                slot=slot,
                block_time=block_time,
                side=side,
                token_mint=top_mint,
                token_symbol=None,
                token_amount=abs(top_delta),
                sol_amount=sol_amount if sol_amount > 0 else 0.0,
                stable_amount=stable_amount,
                price_native=price_native,
                price_usd_est=price_usd,
            )
        except Exception:  # noqa: BLE001
            return None

    def _account_keys(self, tx: dict) -> List[str]:
        tr = (tx.get("transaction") or {}).get("message") or {}
        keys = tr.get("accountKeys") or []
        out: List[str] = []
        for k in keys:
            if isinstance(k, str):
                out.append(k)
            elif isinstance(k, dict):
                out.append(k.get("pubkey") or "")
        return out
