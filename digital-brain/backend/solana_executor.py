"""LiveExecutor — real Solana on-chain execution for the brain.

Wraps a Jupiter aggregator swap + a Solana RPC submit around a keypair
loaded exclusively from the ``BRAIN_SOL_PRIVKEY`` environment variable.

Design axioms:
    * The private key never touches disk, never enters a log line,
      never appears in a snapshot dict, never leaves this process.
    * Every trade is gated by hard, layered limits: per-trade lamports,
      hourly lamports, daily lamports, and concurrent-position count.
    * An operator can HALT all live activity in one env flip
      (``LIVE_TRADING_HALT=1``) without a redeploy.
    * When the environment is misconfigured or the network is flaky
      we degrade to a no-op — paper trading continues untouched.
    * Every attempted swap is recorded with amount, signature (if any)
      and outcome so the UI can show a real ledger.

We import solders / httpx lazily so that a pod without the packages can
still boot in paper mode.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Optional


LOG = logging.getLogger("solana_executor")

# ---- Well-known mints -------------------------------------------------------
SOL_MINT = "So11111111111111111111111111111111111111112"           # wrapped SOL
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"          # USDC

LAMPORTS_PER_SOL = 1_000_000_000

JUP_QUOTE_URL = os.getenv("JUPITER_QUOTE_URL", "https://lite-api.jup.ag/swap/v1/quote")
JUP_SWAP_URL = os.getenv("JUPITER_SWAP_URL", "https://lite-api.jup.ag/swap/v1/swap")
DEFAULT_RPC = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")


# ---- Hard limits (safe defaults; override via env) --------------------------
def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


@dataclass
class ExecutorLimits:
    # Maximum SOL notional on any single swap. 0.005 SOL ≈ $0.75 at $150/SOL.
    max_trade_sol: float = 0.005
    # Rolling caps: the executor refuses to spend more than this within
    # the given window.
    max_hourly_sol: float = 0.02
    max_daily_sol: float = 0.06
    # Maximum concurrent open positions we're allowed to hold on chain.
    max_positions: int = 2
    # Minimum liquidity we require in a pool before we'll touch it.
    min_liquidity_usd: float = 40_000.0
    # Max slippage we're willing to accept (basis points, 100 = 1%).
    max_slippage_bps: int = 500
    # Confidence gate — the trader cortex must be at least this sure before
    # we spend real money. Deliberately higher than paper's 0.5.
    min_confidence: float = 0.75

    @classmethod
    def from_env(cls) -> "ExecutorLimits":
        return cls(
            max_trade_sol=_env_float("LIVE_MAX_TRADE_SOL", 0.005),
            max_hourly_sol=_env_float("LIVE_MAX_HOURLY_SOL", 0.02),
            max_daily_sol=_env_float("LIVE_MAX_DAILY_SOL", 0.06),
            max_positions=_env_int("LIVE_MAX_POSITIONS", 2),
            min_liquidity_usd=_env_float("LIVE_MIN_LIQ_USD", 40_000.0),
            max_slippage_bps=_env_int("LIVE_MAX_SLIPPAGE_BPS", 500),
            min_confidence=_env_float("LIVE_MIN_CONFIDENCE", 0.75),
        )


@dataclass
class LiveTradeRecord:
    t: int                     # unix seconds
    side: str                  # "buy" | "sell"
    token_mint: str
    token_symbol: str
    sol_amount: float          # signed: negative on buy (spent), positive on sell (received)
    tx_sig: Optional[str] = None
    status: str = "pending"    # "pending" | "confirmed" | "failed" | "blocked" | "dry_run"
    error: Optional[str] = None

    def to_public(self) -> dict:
        return {
            "t": self.t,
            "side": self.side,
            "token_mint": self.token_mint,
            "token_symbol": self.token_symbol,
            "sol_amount": round(self.sol_amount, 6),
            "tx_sig": self.tx_sig,
            "status": self.status,
            "error": self.error,
        }


# =============================================================================


class LiveExecutor:
    """Real Solana executor. Instantiate ONCE, from the trading service."""

    def __init__(self, privkey_hex: str, limits: Optional[ExecutorLimits] = None,
                 rpc_url: str = DEFAULT_RPC, state_path: Optional[str] = None):
        # Lazy imports so we don't hard-require solders at module load time
        # (paper-mode pods still boot).
        from solders.keypair import Keypair  # type: ignore

        seed = self._decode_seed(privkey_hex)
        self.keypair: "Keypair" = Keypair.from_seed(seed)
        self.pubkey_str: str = str(self.keypair.pubkey())
        self.rpc_url = rpc_url
        self.limits = limits or ExecutorLimits.from_env()
        # Rolling ledger — capped so it doesn't grow forever.
        self._ledger: Deque[LiveTradeRecord] = deque(maxlen=200)
        # Live SOL balance snapshot (refreshed by the trading loop).
        self.sol_balance: float = 0.0
        self.sol_balance_at_s: float = 0.0
        # Open positions we've opened during this process (mint → info).
        # Persisted to disk so a pod restart doesn't strand real positions
        # that we can never close (we'd forget the raw token amount).
        self.open_positions: Dict[str, dict] = {}
        self._state_path = state_path or os.path.join(
            os.getenv("DATA_DIR", "./data"), "live_positions.json"
        )
        self._load_positions()
        # httpx.AsyncClient created lazily.
        self._http = None

    # --- position persistence -------------------------------------------

    def _load_positions(self) -> None:
        try:
            import json
            with open(self._state_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and isinstance(data.get("open_positions"), dict):
                self.open_positions = data["open_positions"]
                LOG.info("restored %d live position(s) from disk",
                         len(self.open_positions))
        except FileNotFoundError:
            pass
        except Exception as e:  # noqa: BLE001
            LOG.warning("failed to load live positions: %s", e)

    def _save_positions(self) -> None:
        try:
            import json, os as _os
            _os.makedirs(_os.path.dirname(self._state_path) or ".", exist_ok=True)
            tmp = self._state_path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump({"open_positions": self.open_positions}, f)
            _os.replace(tmp, self._state_path)
        except Exception as e:  # noqa: BLE001
            LOG.warning("failed to persist live positions: %s", e)

    # --- construction helpers --------------------------------------------

    @staticmethod
    def _decode_seed(privkey: str) -> bytes:
        """Accept either a 64-char hex seed, a base58-encoded 32/64-byte
        secret, or a JSON `[u8; 64]` array. We ONLY store the resulting
        bytes locally, never log them."""
        privkey = (privkey or "").strip()
        if not privkey:
            raise ValueError("empty BRAIN_SOL_PRIVKEY")
        # JSON array form?
        if privkey.startswith("["):
            import json
            arr = json.loads(privkey)
            b = bytes(arr)
            if len(b) == 64:
                return b[:32]
            if len(b) == 32:
                return b
            raise ValueError(f"JSON key must be 32 or 64 bytes, got {len(b)}")
        # Hex form?
        try:
            b = bytes.fromhex(privkey)
        except ValueError:
            b = None
        if b is not None:
            if len(b) == 32:
                return b
            if len(b) == 64:
                return b[:32]
        # base58 form?
        try:
            import base58  # type: ignore
            b = base58.b58decode(privkey)
            if len(b) == 32:
                return b
            if len(b) == 64:
                return b[:32]
        except Exception:  # noqa: BLE001
            pass
        raise ValueError("BRAIN_SOL_PRIVKEY is not hex, base58, or JSON array")

    # --- circuit breakers ------------------------------------------------

    def is_halted(self) -> bool:
        """Runtime kill switch: `LIVE_TRADING_HALT=1` blocks everything."""
        return os.getenv("LIVE_TRADING_HALT", "0").strip() in ("1", "true", "yes", "on")

    def is_dry_run(self) -> bool:
        """When set, quotes are still computed but no transaction is
        broadcast. Useful to observe what live mode WOULD do."""
        return os.getenv("LIVE_TRADING_DRY_RUN", "0").strip() in ("1", "true", "yes", "on")

    # --- rolling spend accounting ---------------------------------------

    def spent_last(self, window_s: float) -> float:
        cutoff = time.time() - window_s
        total = 0.0
        for r in self._ledger:
            if r.side != "buy" or r.status not in ("confirmed", "pending", "dry_run"):
                continue
            if r.t >= cutoff:
                total += abs(r.sol_amount)
        return total

    def _pre_trade_check(self, sol_amount: float, liquidity_usd: float,
                          confidence: float) -> Optional[str]:
        if self.is_halted():
            return "halted"
        if sol_amount <= 0:
            return "zero_amount"
        if sol_amount > self.limits.max_trade_sol + 1e-9:
            return f"per_trade_cap_{self.limits.max_trade_sol:.4f}"
        if liquidity_usd < self.limits.min_liquidity_usd:
            return f"low_liquidity_{liquidity_usd:.0f}"
        if confidence < self.limits.min_confidence:
            return f"low_confidence_{confidence:.2f}"
        if len(self.open_positions) >= self.limits.max_positions:
            return f"max_positions_{self.limits.max_positions}"
        if self.spent_last(3600) + sol_amount > self.limits.max_hourly_sol + 1e-9:
            return f"hourly_cap_{self.limits.max_hourly_sol:.4f}"
        if self.spent_last(86400) + sol_amount > self.limits.max_daily_sol + 1e-9:
            return f"daily_cap_{self.limits.max_daily_sol:.4f}"
        if sol_amount > self.sol_balance * 0.9:
            return f"insufficient_balance_{self.sol_balance:.4f}"
        return None

    # --- http ----------------------------------------------------------------

    async def _client(self):
        if self._http is None:
            import httpx  # type: ignore
            self._http = httpx.AsyncClient(timeout=20.0)
        return self._http

    async def close(self) -> None:
        if self._http is not None:
            try:
                await self._http.aclose()
            except Exception:  # noqa: BLE001
                pass
            self._http = None

    # --- RPC probes ----------------------------------------------------------

    async def refresh_sol_balance(self) -> float:
        """Ask the Solana RPC for the SOL balance of our keypair."""
        try:
            http = await self._client()
            r = await http.post(self.rpc_url, json={
                "jsonrpc": "2.0", "id": 1, "method": "getBalance",
                "params": [self.pubkey_str, {"commitment": "confirmed"}],
            })
            r.raise_for_status()
            js = r.json()
            lamports = int(((js.get("result") or {}).get("value")) or 0)
            self.sol_balance = lamports / LAMPORTS_PER_SOL
            self.sol_balance_at_s = time.time()
            return self.sol_balance
        except Exception as e:  # noqa: BLE001
            LOG.debug("sol balance refresh failed: %s", e)
            return self.sol_balance

    # --- swap ----------------------------------------------------------------

    async def buy(self, output_mint: str, symbol: str, sol_amount: float,
                  liquidity_usd: float, confidence: float) -> LiveTradeRecord:
        """Buy `output_mint` with `sol_amount` SOL, subject to limits."""
        reason = self._pre_trade_check(sol_amount, liquidity_usd, confidence)
        if reason:
            rec = LiveTradeRecord(
                t=int(time.time()), side="buy",
                token_mint=output_mint, token_symbol=symbol,
                sol_amount=-abs(sol_amount), status="blocked", error=reason,
            )
            self._ledger.append(rec)
            return rec
        lamports = int(sol_amount * LAMPORTS_PER_SOL)
        return await self._swap(
            side="buy", token_mint=output_mint, symbol=symbol,
            input_mint=SOL_MINT, output_mint=output_mint,
            input_lamports=lamports, sol_amount=sol_amount,
        )

    async def sell(self, input_mint: str, symbol: str, token_amount_raw: int,
                    liquidity_usd: float) -> LiveTradeRecord:
        """Sell all `token_amount_raw` of `input_mint` back to SOL. Sells
        skip the per-trade caps intentionally — closing a position must
        not be blocked by risk gates."""
        if self.is_halted():
            rec = LiveTradeRecord(
                t=int(time.time()), side="sell",
                token_mint=input_mint, token_symbol=symbol,
                sol_amount=0.0, status="blocked", error="halted",
            )
            self._ledger.append(rec)
            return rec
        if liquidity_usd < self.limits.min_liquidity_usd:
            # Still allow selling — closing is more important than gating.
            LOG.info("sell %s in low-liq pool ($%.0f) — proceeding anyway",
                     symbol, liquidity_usd)
        return await self._swap(
            side="sell", token_mint=input_mint, symbol=symbol,
            input_mint=input_mint, output_mint=SOL_MINT,
            input_lamports=int(token_amount_raw), sol_amount=0.0,
        )

    async def _swap(self, *, side: str, token_mint: str, symbol: str,
                     input_mint: str, output_mint: str,
                     input_lamports: int, sol_amount: float) -> LiveTradeRecord:
        rec = LiveTradeRecord(
            t=int(time.time()), side=side,
            token_mint=token_mint, token_symbol=symbol,
            sol_amount=-abs(sol_amount) if side == "buy" else 0.0,
            status="pending",
        )
        try:
            http = await self._client()
            # 1) Quote
            q = await http.get(JUP_QUOTE_URL, params={
                "inputMint": input_mint,
                "outputMint": output_mint,
                "amount": str(input_lamports),
                "slippageBps": str(self.limits.max_slippage_bps),
                "onlyDirectRoutes": "false",
            })
            q.raise_for_status()
            quote = q.json()
            if not quote or quote.get("error"):
                rec.status = "failed"
                rec.error = f"quote:{quote.get('error') if quote else 'empty'}"
                self._ledger.append(rec)
                return rec
            # 2) Dry-run short-circuit
            if self.is_dry_run():
                rec.status = "dry_run"
                self._ledger.append(rec)
                return rec
            # 3) Build swap transaction
            s = await http.post(JUP_SWAP_URL, json={
                "quoteResponse": quote,
                "userPublicKey": self.pubkey_str,
                "wrapAndUnwrapSol": True,
                "dynamicComputeUnitLimit": True,
                "prioritizationFeeLamports": "auto",
            })
            s.raise_for_status()
            swap = s.json()
            b64_tx = swap.get("swapTransaction")
            if not b64_tx:
                rec.status = "failed"
                rec.error = "no_swap_tx"
                self._ledger.append(rec)
                return rec
            # 4) Sign
            import base64
            from solders.transaction import VersionedTransaction  # type: ignore
            raw = base64.b64decode(b64_tx)
            unsigned = VersionedTransaction.from_bytes(raw)
            signed = VersionedTransaction(unsigned.message, [self.keypair])
            wire = bytes(signed)
            wire_b64 = base64.b64encode(wire).decode()
            # 5) Submit
            r = await http.post(self.rpc_url, json={
                "jsonrpc": "2.0", "id": 1, "method": "sendTransaction",
                "params": [wire_b64, {"encoding": "base64",
                                       "skipPreflight": False,
                                       "maxRetries": 3}],
            })
            r.raise_for_status()
            js = r.json()
            if "error" in js and js["error"]:
                rec.status = "failed"
                rec.error = str(js["error"])[:180]
            else:
                sig = js.get("result")
                rec.tx_sig = sig
                rec.status = "confirmed"  # best-effort; we don't wait for finality
                # Track position bookkeeping so limits work AND so sell()
                # knows exactly how many raw token units we hold.
                if side == "buy":
                    out_amount_raw = 0
                    try:
                        out_amount_raw = int(quote.get("outAmount") or 0)
                    except (TypeError, ValueError):
                        out_amount_raw = 0
                    self.open_positions[token_mint] = {
                        "symbol": symbol,
                        "opened_at_s": rec.t,
                        "sol_spent": abs(sol_amount),
                        "out_amount_raw": out_amount_raw,
                        "buy_sig": sig,
                    }
                else:
                    self.open_positions.pop(token_mint, None)
                self._save_positions()
        except Exception as e:  # noqa: BLE001
            rec.status = "failed"
            rec.error = str(e)[:180]
            LOG.warning("live %s of %s failed: %s", side, symbol, e)
        self._ledger.append(rec)
        return rec

    # --- snapshot ------------------------------------------------------------

    def snapshot(self) -> dict:
        L = self.limits
        return {
            "wallet": self.pubkey_str,
            "wallet_short": self.pubkey_str[:4] + "…" + self.pubkey_str[-4:],
            "sol_balance": round(self.sol_balance, 6),
            "sol_balance_at_s": int(self.sol_balance_at_s),
            "halted": self.is_halted(),
            "dry_run": self.is_dry_run(),
            "open_positions_count": len(self.open_positions),
            "spent_last_hour_sol": round(self.spent_last(3600), 6),
            "spent_last_day_sol": round(self.spent_last(86400), 6),
            "limits": {
                "max_trade_sol": L.max_trade_sol,
                "max_hourly_sol": L.max_hourly_sol,
                "max_daily_sol": L.max_daily_sol,
                "max_positions": L.max_positions,
                "min_liquidity_usd": L.min_liquidity_usd,
                "max_slippage_bps": L.max_slippage_bps,
                "min_confidence": L.min_confidence,
            },
            "recent_trades": [r.to_public() for r in list(self._ledger)[-15:]],
        }


# =============================================================================


def build_from_env() -> Optional[LiveExecutor]:
    """Try to build a LiveExecutor from environment. Returns None if the
    key is missing or malformed — the trading service then continues in
    paper-only mode.

    We do NOT log any part of the key on failure — the exception message
    from `_decode_seed` is deliberately generic.
    """
    key = os.getenv("BRAIN_SOL_PRIVKEY", "").strip()
    if not key:
        LOG.info("BRAIN_SOL_PRIVKEY not set — live execution disabled")
        return None
    if os.getenv("LIVE_SOL_ENABLED", "1").strip() in ("0", "false", "no", "off"):
        LOG.info("LIVE_SOL_ENABLED=off — SOL live execution disabled")
        return None
    try:
        return LiveExecutor(privkey_hex=key, limits=ExecutorLimits.from_env())
    except Exception as e:  # noqa: BLE001
        LOG.warning("failed to init LiveExecutor: %s — falling back to paper-only",
                    type(e).__name__)
        return None
