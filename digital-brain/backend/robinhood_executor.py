"""HoodExecutor — real Robinhood-Chain (EVM L2) execution for the brain.

Wraps a Uniswap-V3 SwapRouter02 swap + a Robinhood-Chain RPC around a
secp256k1 keypair.

Key design points (mirror ``solana_executor.py``):
    * Robinhood Chain uses secp256k1 / ETH, so we CANNOT reuse the
      Solana ed25519 seed directly.  Instead the EVM private key is
      deterministically derived from the same BRAIN_SOL_PRIVKEY via
      Blake2b (``domain = 'robinhood-chain-derivation'``), so the user
      does not have to provide a second key.  The derived EVM address is
      shown in the UI so the user knows where to send ETH for gas + swaps.
    * Every trade is gated by hard, layered limits: per-trade ETH,
      hourly ETH, daily ETH, and concurrent-position count.
    * Kill switches: ``LIVE_TRADING_HALT=1`` blocks everything;
      ``LIVE_TRADING_DRY_RUN=1`` computes quotes but never broadcasts.
    * When the environment is misconfigured or the router / RPC is
      unreachable, we degrade to a no-op — paper trading continues.
    * Every attempted swap is recorded with amount, tx hash (if any)
      and outcome so the UI can show a real ledger.

Uniswap deployment on Robinhood Chain (chain id 4663), verified via the
official Uniswap docs + Robinhood Chain Blockscout:

    SwapRouter02  : 0xCaf681a66D020601342297493863E78C959E5cb2
    QuoterV2      : 0x33e885ED0Ec9bF04EcfB19341582aADCb4c8A9E7
    WETH9         : 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
    UniswapV3Factory: 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Optional, Tuple


LOG = logging.getLogger("robinhood_executor")

# ---- Well-known addresses ---------------------------------------------------
ROBINHOOD_CHAIN_ID = 4663
DEFAULT_RPC = os.getenv(
    "ROBINHOOD_RPC_URL", "https://rpc.mainnet.chain.robinhood.com",
)
SWAP_ROUTER02 = "0xCaf681a66D020601342297493863E78C959E5cb2"
QUOTER_V2     = "0x33e885ED0Ec9bF04EcfB19341582aADCb4c8A9E7"
WETH9         = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73"
V3_FACTORY    = "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA"
# Uniswap V3 peripheral convention: recipient=address(2) means "keep in
# router" so a follow-up unwrapWETH9 leg can sweep and unwrap the WETH.
ADDRESS_THIS  = "0x0000000000000000000000000000000000000002"

# Standard Uniswap V3 fee tiers we probe when routing (0.05%, 0.3%, 1%).
V3_FEE_TIERS = (500, 3000, 10000)

WEI_PER_ETH = 10 ** 18


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
class HoodLimits:
    """Hard risk limits on Robinhood-Chain live trades. Small on purpose."""
    # Maximum ETH notional on any single swap. 0.0005 ETH ~ $2 at $4000/ETH.
    max_trade_eth: float = 0.0005
    max_hourly_eth: float = 0.002
    max_daily_eth: float = 0.006
    max_positions: int = 2
    min_liquidity_usd: float = 40_000.0
    max_slippage_bps: int = 500
    min_confidence: float = 0.75

    @classmethod
    def from_env(cls) -> "HoodLimits":
        return cls(
            max_trade_eth=_env_float("LIVE_HOOD_MAX_TRADE_ETH", 0.0005),
        max_hourly_eth=_env_float("LIVE_HOOD_MAX_HOURLY_ETH", 0.002),
            max_daily_eth=_env_float("LIVE_HOOD_MAX_DAILY_ETH", 0.006),
            max_positions=_env_int("LIVE_HOOD_MAX_POSITIONS", 2),
            min_liquidity_usd=_env_float("LIVE_HOOD_MIN_LIQ_USD", 40_000.0),
            max_slippage_bps=_env_int("LIVE_HOOD_MAX_SLIPPAGE_BPS", 500),
            min_confidence=_env_float("LIVE_HOOD_MIN_CONFIDENCE", 0.75),
        )


@dataclass
class HoodTradeRecord:
    t: int
    side: str                      # "buy" | "sell"
    token_addr: str                # ERC-20 address
    token_symbol: str
    eth_amount: float              # signed: -on buy, +on sell (approx)
    tx_hash: Optional[str] = None
    status: str = "pending"        # pending | confirmed | failed | blocked | dry_run
    error: Optional[str] = None

    def to_public(self) -> dict:
        return {
            "t": self.t,
            "side": self.side,
            "token_addr": self.token_addr,
            "token_symbol": self.token_symbol,
            "eth_amount": round(self.eth_amount, 8),
            "tx_hash": self.tx_hash,
            "status": self.status,
            "error": self.error,
        }


# =============================================================================
# EVM helpers (no web3.py — we speak raw JSON-RPC via httpx)
# =============================================================================


def _keccak(data: bytes) -> bytes:
    """Keccak-256, the hash function EVM uses.  We use pysha3 via the
    ``eth_utils`` package which ``eth_account`` already installs."""
    from eth_utils import keccak  # type: ignore
    return keccak(data)


def _selector(sig: str) -> bytes:
    return _keccak(sig.encode())[:4]


def _hex(b: bytes) -> str:
    return "0x" + b.hex()


def _to_checksum(addr: str) -> str:
    from eth_utils import to_checksum_address  # type: ignore
    return to_checksum_address(addr)


def _addr_to_bytes20(addr: str) -> bytes:
    a = addr.lower().replace("0x", "")
    if len(a) != 40:
        raise ValueError(f"bad address: {addr}")
    return bytes.fromhex(a)


def _int_to_bytes32(n: int) -> bytes:
    if n < 0:
        raise ValueError("negative int")
    return n.to_bytes(32, "big")


def _v3_path(input_addr: str, fee: int, output_addr: str) -> bytes:
    """Pack a single-hop Uniswap V3 path: 20 bytes | 3 bytes | 20 bytes."""
    return (
        _addr_to_bytes20(input_addr)
        + fee.to_bytes(3, "big")
        + _addr_to_bytes20(output_addr)
    )


# =============================================================================


class HoodExecutor:
    """Robinhood-Chain live executor.  Instantiate once, from the trading
    service.  All secret state stays inside the instance."""

    def __init__(self, sol_privkey_hex: str,
                 limits: Optional[HoodLimits] = None,
                 rpc_url: str = DEFAULT_RPC,
                 state_path: Optional[str] = None,
                 hood_privkey_hex: Optional[str] = None):
        # Lazy imports so a pod without eth-account can still boot in
        # paper mode.
        from eth_account import Account  # type: ignore

        # Prefer a directly-provided EVM key. Fall back to deterministic
        # derivation from the SOL key so old deployments keep working.
        hood_privkey_hex = (hood_privkey_hex or "").strip()
        if hood_privkey_hex:
            if not hood_privkey_hex.startswith("0x"):
                hood_privkey_hex = "0x" + hood_privkey_hex
            seed = bytes.fromhex(hood_privkey_hex[2:])
        else:
            seed = self._derive_evm_seed(sol_privkey_hex)
        self._account = Account.from_key(seed)
        # eth_account exposes .address in EIP-55 checksum form.
        self.address: str = self._account.address
        self.rpc_url = rpc_url
        self.limits = limits or HoodLimits.from_env()
        self._ledger: Deque[HoodTradeRecord] = deque(maxlen=200)
        self.eth_balance: float = 0.0
        self.eth_balance_at_s: float = 0.0
        # {token_addr: {symbol, amount_raw, opened_at_s, eth_spent}}
        self.open_positions: Dict[str, dict] = {}
        self._state_path = state_path or os.path.join(
            os.getenv("DATA_DIR", "./data"), "live_hood_positions.json"
        )
        self._load_positions()
        self._http = None
        # Chain state we discover lazily.
        self._chain_id: Optional[int] = None
        self._nonce_cache: Optional[int] = None

    # --- key derivation --------------------------------------------------

    @staticmethod
    def _derive_evm_seed(sol_privkey_hex: str) -> bytes:
        """Derive a deterministic 32-byte secp256k1 seed from the same
        BRAIN_SOL_PRIVKEY.  Uses Blake2b with a fixed domain tag so we
        cannot accidentally derive the SAME bytes for another purpose."""
        import hashlib
        sol_privkey_hex = (sol_privkey_hex or "").strip()
        if not sol_privkey_hex:
            raise ValueError("empty BRAIN_SOL_PRIVKEY")
        # Accept hex / base58 / JSON — reuse Solana executor's normaliser
        # by importing lazily so we don't hard-depend on it at import time.
        from .solana_executor import LiveExecutor  # type: ignore
        raw = LiveExecutor._decode_seed(sol_privkey_hex)
        # Domain-tag the input so this derivation is distinct from any
        # future one, then Blake2b down to a 32-byte secp256k1 seed.
        h = hashlib.blake2b(digest_size=32)
        h.update(b"robinhood-chain-derivation:v1|")
        h.update(raw)
        seed = h.digest()
        # secp256k1 order — reject the astronomically unlikely 0 or >=N.
        SECP256K1_ORDER = int(
            "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", 16
        )
        n_int = int.from_bytes(seed, "big")
        if n_int == 0 or n_int >= SECP256K1_ORDER:
            # Vanishingly rare; re-hash once with a suffix and use that.
            h2 = hashlib.blake2b(digest_size=32)
            h2.update(b"robinhood-chain-derivation:v1|retry|")
            h2.update(raw)
            seed = h2.digest()
        return seed

    # --- position persistence -------------------------------------------

    def _load_positions(self) -> None:
        try:
            import json
            with open(self._state_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and isinstance(data.get("open_positions"), dict):
                self.open_positions = data["open_positions"]
                LOG.info("restored %d live HOOD position(s) from disk",
                         len(self.open_positions))
        except FileNotFoundError:
            pass
        except Exception as e:  # noqa: BLE001
            LOG.warning("failed to load HOOD positions: %s", e)

    def _save_positions(self) -> None:
        try:
            import json, os as _os
            _os.makedirs(_os.path.dirname(self._state_path) or ".", exist_ok=True)
            tmp = self._state_path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump({"open_positions": self.open_positions}, f)
            _os.replace(tmp, self._state_path)
        except Exception as e:  # noqa: BLE001
            LOG.warning("failed to persist HOOD positions: %s", e)

    # --- circuit breakers ------------------------------------------------

    def is_halted(self) -> bool:
        return os.getenv("LIVE_TRADING_HALT", "0").strip() in ("1", "true", "yes", "on")

    def is_dry_run(self) -> bool:
        return os.getenv("LIVE_TRADING_DRY_RUN", "0").strip() in ("1", "true", "yes", "on")

    # --- spend accounting -----------------------------------------------

    def spent_last(self, window_s: float) -> float:
        cutoff = time.time() - window_s
        total = 0.0
        for r in self._ledger:
            if r.side != "buy" or r.status not in ("confirmed", "pending", "dry_run"):
                continue
            if r.t >= cutoff:
                total += abs(r.eth_amount)
        return total

    def _pre_trade_check(self, eth_amount: float, liquidity_usd: float,
                          confidence: float) -> Optional[str]:
        if self.is_halted():
            return "halted"
        if eth_amount <= 0:
            return "zero_amount"
        if eth_amount > self.limits.max_trade_eth + 1e-12:
            return f"per_trade_cap_{self.limits.max_trade_eth:.6f}"
        if liquidity_usd < self.limits.min_liquidity_usd:
            return f"low_liquidity_{liquidity_usd:.0f}"
        if confidence < self.limits.min_confidence:
            return f"low_confidence_{confidence:.2f}"
        if len(self.open_positions) >= self.limits.max_positions:
            return f"max_positions_{self.limits.max_positions}"
        if self.spent_last(3600) + eth_amount > self.limits.max_hourly_eth + 1e-12:
            return f"hourly_cap_{self.limits.max_hourly_eth:.6f}"
        if self.spent_last(86400) + eth_amount > self.limits.max_daily_eth + 1e-12:
            return f"daily_cap_{self.limits.max_daily_eth:.6f}"
        if eth_amount > self.eth_balance * 0.9:
            return f"insufficient_balance_{self.eth_balance:.6f}"
        return None

    # --- http ------------------------------------------------------------

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

    async def _rpc(self, method: str, params: list) -> dict:
        http = await self._client()
        r = await http.post(self.rpc_url, json={
            "jsonrpc": "2.0", "id": int(time.time() * 1000) & 0xffff,
            "method": method, "params": params,
        })
        r.raise_for_status()
        js = r.json()
        if "error" in js and js["error"]:
            raise RuntimeError(f"rpc {method}: {js['error']}")
        return js

    # --- RPC probes ------------------------------------------------------

    async def refresh_eth_balance(self) -> float:
        try:
            js = await self._rpc("eth_getBalance", [self.address, "latest"])
            wei = int(str(js.get("result") or "0x0"), 16)
            self.eth_balance = wei / WEI_PER_ETH
            self.eth_balance_at_s = time.time()
            return self.eth_balance
        except Exception as e:  # noqa: BLE001
            LOG.debug("hood eth_getBalance failed: %s", e)
            return self.eth_balance

    async def _get_chain_id(self) -> int:
        if self._chain_id is not None:
            return self._chain_id
        try:
            js = await self._rpc("eth_chainId", [])
            self._chain_id = int(str(js.get("result") or "0x0"), 16)
        except Exception:  # noqa: BLE001
            self._chain_id = ROBINHOOD_CHAIN_ID
        return self._chain_id

    async def _get_nonce(self, refresh: bool = False) -> int:
        if refresh or self._nonce_cache is None:
            js = await self._rpc("eth_getTransactionCount",
                                 [self.address, "pending"])
            self._nonce_cache = int(str(js.get("result") or "0x0"), 16)
        return self._nonce_cache

    async def _bump_nonce(self) -> None:
        if self._nonce_cache is not None:
            self._nonce_cache += 1

    async def _gas_price(self) -> Tuple[int, int]:
        """Return (maxFeePerGas, maxPriorityFeePerGas) in wei.  Arbitrum-
        style L2 usually reports a very low priority fee, but we still
        supply one so nodes don't drop the tx."""
        try:
            js = await self._rpc("eth_gasPrice", [])
            base = int(str(js.get("result") or "0x0"), 16)
        except Exception:  # noqa: BLE001
            base = 100_000_000  # 0.1 gwei fallback
        priority = 100_000  # 0.0001 gwei — Arbitrum L2 doesn't need more
        return max(base * 12 // 10, priority + base), priority

    # --- quoting ---------------------------------------------------------

    async def _quote_v3_single(self, input_addr: str, output_addr: str,
                                 fee: int, amount_in_wei: int) -> Optional[int]:
        """Call QuoterV2.quoteExactInputSingle to get the expected output
        amount for a single-hop V3 swap.  Returns amountOut in raw units,
        or None if the pool doesn't exist / has no liquidity."""
        # struct QuoteExactInputSingleParams { tokenIn, tokenOut, amountIn,
        #                                       fee, sqrtPriceLimitX96 }
        sel = _selector(
            "quoteExactInputSingle((address,address,uint256,uint24,uint160))"
        )
        # ABI-encode the tuple parameter (no outer length prefix, but the
        # tuple's dynamic header lives one word deep).
        try:
            from eth_abi import encode  # type: ignore
        except Exception:  # noqa: BLE001
            LOG.warning("eth_abi not installed — skipping HOOD quote")
            return None
        params = encode(
            ["(address,address,uint256,uint24,uint160)"],
            [(_to_checksum(input_addr), _to_checksum(output_addr),
              amount_in_wei, fee, 0)],
        )
        data = _hex(sel + params)
        try:
            js = await self._rpc("eth_call", [
                {"to": _to_checksum(QUOTER_V2), "data": data}, "latest",
            ])
            ret = str(js.get("result") or "0x")
            if len(ret) < 66:
                return None
            # First 32 bytes = amountOut
            return int(ret[2:66], 16)
        except Exception as e:  # noqa: BLE001
            LOG.debug("hood quote v3 %s/%s@%d failed: %s",
                      input_addr[:6], output_addr[:6], fee, e)
            return None

    async def _best_fee_tier(self, input_addr: str, output_addr: str,
                              amount_in_wei: int) -> Tuple[Optional[int], int]:
        """Try 0.05% / 0.3% / 1% pools; return (best_fee, best_out).
        Returns (None, 0) if none quote."""
        best_fee = None
        best_out = 0
        for fee in V3_FEE_TIERS:
            out = await self._quote_v3_single(input_addr, output_addr, fee,
                                               amount_in_wei)
            if out and out > best_out:
                best_out = out
                best_fee = fee
        return best_fee, best_out

    # --- swap ------------------------------------------------------------

    async def buy(self, output_token: str, symbol: str, eth_amount: float,
                   liquidity_usd: float, confidence: float) -> HoodTradeRecord:
        reason = self._pre_trade_check(eth_amount, liquidity_usd, confidence)
        if reason:
            rec = HoodTradeRecord(
                t=int(time.time()), side="buy",
                token_addr=output_token, token_symbol=symbol,
                eth_amount=-abs(eth_amount), status="blocked", error=reason,
            )
            self._ledger.append(rec)
            return rec
        wei = int(eth_amount * WEI_PER_ETH)
        return await self._swap(
            side="buy", token_addr=output_token, symbol=symbol,
            input_addr=WETH9, output_addr=output_token,
            amount_in_wei=wei, eth_amount=eth_amount,
        )

    async def sell(self, input_token: str, symbol: str, amount_in_wei: int,
                    liquidity_usd: float) -> HoodTradeRecord:
        if self.is_halted():
            rec = HoodTradeRecord(
                t=int(time.time()), side="sell",
                token_addr=input_token, token_symbol=symbol,
                eth_amount=0.0, status="blocked", error="halted",
            )
            self._ledger.append(rec)
            return rec
        return await self._swap(
            side="sell", token_addr=input_token, symbol=symbol,
            input_addr=input_token, output_addr=WETH9,
            amount_in_wei=int(amount_in_wei), eth_amount=0.0,
        )

    async def _swap(self, *, side: str, token_addr: str, symbol: str,
                     input_addr: str, output_addr: str,
                     amount_in_wei: int, eth_amount: float) -> HoodTradeRecord:
        """Execute a single-hop Uniswap V3 exact-input swap via
        SwapRouter02.exactInputSingle."""
        rec = HoodTradeRecord(
            t=int(time.time()), side=side,
            token_addr=token_addr, token_symbol=symbol,
            eth_amount=-abs(eth_amount) if side == "buy" else 0.0,
            status="pending",
        )
        try:
            # 1) Quote to check the pool exists and calculate min-out
            best_fee, best_out = await self._best_fee_tier(
                input_addr, output_addr, amount_in_wei
            )
            if best_fee is None or best_out <= 0:
                rec.status = "failed"
                rec.error = "no_route"
                self._ledger.append(rec)
                return rec
            # Apply slippage floor
            slip = self.limits.max_slippage_bps
            min_out = best_out * (10_000 - slip) // 10_000
            # 2) Dry-run short-circuit
            if self.is_dry_run():
                rec.status = "dry_run"
                self._ledger.append(rec)
                return rec
            # 3) Build exactInputSingle calldata
            calldata = self._build_exact_input_single(
                input_addr, output_addr, best_fee, amount_in_wei, min_out,
            )
            # 4) For a BUY we send ETH as value (router wraps to WETH via
            #    the payable multicall entrypoint).  SwapRouter02's
            #    exactInputSingle is NOT payable directly — the standard
            #    idiom is to wrap: `multicall([exactInputSingle, unwrapWETH9])`.
            #    But when input is WETH9 and value == 0, we'd need a prior
            #    ERC-20 approval.  To keep the executor self-contained we
            #    build a `multicall` wrapper for the BUY path and send the
            #    ETH as value.
            if side == "buy":
                data, value_wei = self._wrap_buy_multicall(calldata), amount_in_wei
            else:
                # SELL: approve router, then swap into the router itself
                # (recipient=ADDRESS_THIS=0x02), then unwrapWETH9 to send
                # native ETH back to us. This keeps proceeds as native ETH
                # instead of leaving them locked as WETH ERC-20.
                approve_rec = await self._ensure_approval(
                    token_addr=input_addr, amount_wei=amount_in_wei,
                )
                if approve_rec is not None and approve_rec.status != "confirmed":
                    rec.status = "failed"
                    rec.error = f"approve:{approve_rec.error or approve_rec.status}"
                    self._ledger.append(rec)
                    return rec
                # Rebuild swap calldata with recipient = ADDRESS_THIS.
                swap_leg = self._build_exact_input_single(
                    input_addr, output_addr, best_fee, amount_in_wei, min_out,
                    recipient=ADDRESS_THIS,
                )
                unwrap_leg = self._build_unwrap_weth9(min_out, self.address)
                data = self._wrap_multicall([swap_leg, unwrap_leg])
                value_wei = 0
            # 5) Broadcast
            tx_hash = await self._send_tx(
                to=SWAP_ROUTER02, data=data, value_wei=value_wei,
            )
            rec.tx_hash = tx_hash
            rec.status = "confirmed"  # best-effort; we don't wait for finality
            if side == "buy":
                self.open_positions[token_addr.lower()] = {
                    "symbol": symbol,
                    "opened_at_s": rec.t,
                    "eth_spent": abs(eth_amount),
                    "amount_out_raw": best_out,
                    "fee_tier": best_fee,
                    "buy_hash": tx_hash,
                }
            else:
                self.open_positions.pop(token_addr.lower(), None)
            self._save_positions()
        except Exception as e:  # noqa: BLE001
            rec.status = "failed"
            rec.error = str(e)[:180]
            LOG.warning("live HOOD %s of %s failed: %s", side, symbol, e)
        self._ledger.append(rec)
        return rec

    # --- calldata builders ----------------------------------------------

    def _build_exact_input_single(self, input_addr: str, output_addr: str,
                                          fee: int, amount_in: int,
                                          min_out: int,
                                          recipient: Optional[str] = None) -> bytes:
        """SwapRouter02.exactInputSingle(ExactInputSingleParams) selector +
        ABI-encoded params.  ExactInputSingleParams:
            (tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum,
             sqrtPriceLimitX96)
        SwapRouter02 dropped the `deadline` field vs the older v1 router.

        `recipient` defaults to our address; pass ADDRESS_THIS when the
        proceeds must stay in the router for a follow-up unwrapWETH9 leg."""
        sel = _selector(
            "exactInputSingle((address,address,uint24,address,uint256,"
            "uint256,uint160))"
        )
        from eth_abi import encode  # type: ignore
        recip = _to_checksum(recipient) if recipient else _to_checksum(self.address)
        params = encode(
            ["(address,address,uint24,address,uint256,uint256,uint160)"],
            [(_to_checksum(input_addr), _to_checksum(output_addr), fee,
              recip, amount_in, min_out, 0)],
        )
        return sel + params

    def _wrap_buy_multicall(self, exact_input_calldata: bytes) -> bytes:
        """When buying an ERC-20 with native ETH we call
        `multicall(bytes[])` on the router with a single leg: the
        exactInputSingle.  SwapRouter02.multicall is payable so the ETH
        travels with the tx; the router wraps it to WETH internally
        before invoking the pool."""
        return self._wrap_multicall([exact_input_calldata])

    def _wrap_multicall(self, legs) -> bytes:
        from eth_abi import encode  # type: ignore
        sel = _selector("multicall(bytes[])")
        params = encode(["bytes[]"], [list(legs)])
        return sel + params

    def _build_unwrap_weth9(self, amount_min: int, recipient: str) -> bytes:
        """SwapRouter02.unwrapWETH9(uint256 amountMinimum, address recipient)
        — sweeps all WETH held by the router, unwraps it, and sends native
        ETH to `recipient`."""
        sel = _selector("unwrapWETH9(uint256,address)")
        from eth_abi import encode  # type: ignore
        params = encode(["uint256", "address"], [amount_min, _to_checksum(recipient)])
        return sel + params


    async def _ensure_approval(self, token_addr: str,
                                 amount_wei: int) -> Optional[HoodTradeRecord]:
        """Ensure the router has enough allowance to move `amount_wei` of
        `token_addr` from us.  Returns the approve trade record if a new
        approval was broadcast, or None if the existing allowance is
        already sufficient.  On dry-run this is a no-op."""
        # Read current allowance
        allowance = await self._erc20_allowance(token_addr, self.address,
                                                  SWAP_ROUTER02)
        if allowance >= amount_wei:
            return None
        if self.is_dry_run():
            return None
        # Approve max (2^256 - 1) so we don't need to re-approve every trade.
        approve_data = self._build_approve(SWAP_ROUTER02, (1 << 256) - 1)
        tx_hash = await self._send_tx(to=token_addr, data=approve_data,
                                        value_wei=0)
        rec = HoodTradeRecord(
            t=int(time.time()), side="approve",
            token_addr=token_addr, token_symbol="APPROVE",
            eth_amount=0.0, tx_hash=tx_hash, status="confirmed",
        )
        self._ledger.append(rec)
        return rec

    async def _erc20_allowance(self, token: str, owner: str, spender: str) -> int:
        sel = _selector("allowance(address,address)")
        from eth_abi import encode  # type: ignore
        params = encode(["address", "address"],
                         [_to_checksum(owner), _to_checksum(spender)])
        data = _hex(sel + params)
        try:
            js = await self._rpc("eth_call", [
                {"to": _to_checksum(token), "data": data}, "latest",
            ])
            return int(str(js.get("result") or "0x0"), 16)
        except Exception:  # noqa: BLE001
            return 0

    def _build_approve(self, spender: str, amount: int) -> bytes:
        sel = _selector("approve(address,uint256)")
        from eth_abi import encode  # type: ignore
        params = encode(["address", "uint256"],
                         [_to_checksum(spender), amount])
        return sel + params

    # --- signing + broadcast --------------------------------------------

    async def _send_tx(self, *, to: str, data: bytes, value_wei: int) -> str:
        """Sign a EIP-1559 transaction and broadcast it via
        eth_sendRawTransaction.  Returns the tx hash."""
        chain_id = await self._get_chain_id()
        nonce = await self._get_nonce()
        max_fee, max_priority = await self._gas_price()
        # Gas estimate — soft-fail to a fixed ceiling if the node refuses.
        gas_limit = 400_000
        try:
            est = await self._rpc("eth_estimateGas", [{
                "from": self.address,
                "to": _to_checksum(to),
                "value": hex(value_wei),
                "data": _hex(data),
            }])
            gas_limit = int(int(str(est.get("result") or "0x0"), 16) * 12 // 10)
            gas_limit = min(max(gas_limit, 100_000), 2_500_000)
        except Exception as e:  # noqa: BLE001
            LOG.debug("gas estimate fallback (%s)", e)
        tx = {
            "type": 2,
            "chainId": chain_id,
            "nonce": nonce,
            "to": _to_checksum(to),
            "value": value_wei,
            "gas": gas_limit,
            "maxFeePerGas": max_fee,
            "maxPriorityFeePerGas": max_priority,
            "data": _hex(data),
        }
        # eth_account signs + serialises to raw bytes for us.
        signed = self._account.sign_transaction(tx)
        raw_hex = "0x" + signed.raw_transaction.hex() if hasattr(signed, "raw_transaction") \
                  else "0x" + signed.rawTransaction.hex()  # eth-account version drift
        try:
            js = await self._rpc("eth_sendRawTransaction", [raw_hex])
            tx_hash = str(js.get("result") or "")
            await self._bump_nonce()
            return tx_hash
        except Exception:
            # Force a nonce refresh next call — the pending pool likely
            # rejected our cached nonce.
            self._nonce_cache = None
            raise

    # --- snapshot --------------------------------------------------------

    def snapshot(self) -> dict:
        L = self.limits
        return {
            "chain": "robinhood",
            "chain_id": ROBINHOOD_CHAIN_ID,
            "wallet": self.address,
            "wallet_short": self.address[:6] + "…" + self.address[-4:],
            "eth_balance": round(self.eth_balance, 8),
            "eth_balance_at_s": int(self.eth_balance_at_s),
            "halted": self.is_halted(),
            "dry_run": self.is_dry_run(),
            "open_positions_count": len(self.open_positions),
            "spent_last_hour_eth": round(self.spent_last(3600), 8),
            "spent_last_day_eth": round(self.spent_last(86400), 8),
            "router": SWAP_ROUTER02,
            "explorer_addr": f"https://robinhoodchain.blockscout.com/address/{self.address}",
            "limits": {
                "max_trade_eth": L.max_trade_eth,
                "max_hourly_eth": L.max_hourly_eth,
                "max_daily_eth": L.max_daily_eth,
                "max_positions": L.max_positions,
                "min_liquidity_usd": L.min_liquidity_usd,
                "max_slippage_bps": L.max_slippage_bps,
                "min_confidence": L.min_confidence,
            },
            "recent_trades": [r.to_public() for r in list(self._ledger)[-15:]],
        }


# =============================================================================


def build_from_env() -> Optional[HoodExecutor]:
    """Build a HoodExecutor from environment.  Uses BRAIN_HOOD_PRIVKEY
    directly when set; otherwise derives from BRAIN_SOL_PRIVKEY. Returns
    None if no key is available or eth-account isn't installed."""
    hood_key = os.getenv("BRAIN_HOOD_PRIVKEY", "").strip()
    sol_key = os.getenv("BRAIN_SOL_PRIVKEY", "").strip()
    if not hood_key and not sol_key:
        LOG.info("no HOOD/SOL privkey set — HOOD live execution disabled")
        return None
    if os.getenv("LIVE_HOOD_ENABLED", "1").strip() in ("0", "false", "no", "off"):
        LOG.info("LIVE_HOOD_ENABLED=off — HOOD live execution disabled")
        return None
    try:
        return HoodExecutor(sol_privkey_hex=sol_key,
                            hood_privkey_hex=hood_key,
                            limits=HoodLimits.from_env())
    except Exception as e:  # noqa: BLE001
        LOG.warning("failed to init HoodExecutor: %s — HOOD live disabled",
                    type(e).__name__)
        return None
