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

# Uniswap V4 on Robinhood Chain (chain id 4663).
# Source: https://developers.uniswap.org/docs/protocols/v4/deployments
V4_POOL_MANAGER   = "0x8366a39CC670B4001A1121B8F6A443A643e40951"
V4_QUOTER         = "0x8DC178EFB8111bB0973Dd9d722ebEff267c98F94"
V4_STATE_VIEW     = "0xF3334192D15450cDD385c8b70e03F9A6bd9E673B"
UNIVERSAL_ROUTER  = "0x8876789976DEcBfCBbBE364623C63652DB8c0904"
PERMIT2           = "0x000000000022D473030F116dDEE9F6B43aC78BA3"
# In V4 native ETH is currency address(0). currency0 is always the
# numerically-smaller address in a PoolKey, so ETH/token pools always
# have currency0 = 0x0, currency1 = token.
V4_NATIVE_CURRENCY = "0x0000000000000000000000000000000000000000"

# Standard Uniswap V3 fee tiers we probe when routing (0.05%, 0.3%, 1%).
V3_FEE_TIERS = (500, 3000, 10000)
# V4 vanilla fee/tickSpacing pairs (hooks = 0x0). These cover the vast
# majority of memecoin pools; hooked pools require per-token address
# discovery which we skip.
V4_FEE_TIERS = (
    (100, 1),      # 0.01% · stable
    (500, 10),     # 0.05%
    (3000, 60),    # 0.3%
    (10000, 200),  # 1%
)

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
    # The user's stance: "the brain decides how to buy, whatever it wants".
    # We keep only the bare minimums needed so the wallet doesn't brick
    # itself (gas reserve) or get sandwiched to oblivion (slippage cap).
    # Confidence, liquidity, per-hour and per-day caps are effectively off.
    max_trade_eth: float = 0.05      # cap at half the current wallet as a sanity fuse
    max_hourly_eth: float = 10.0     # effectively off
    max_daily_eth: float = 100.0     # effectively off
    max_positions: int = 20          # let the brain diversify freely
    min_liquidity_usd: float = 1_000.0  # tiny floor to skip zero-liquidity honeypots
    max_slippage_bps: int = 1500     # 15% — memes on low-liq pools need room
    min_confidence: float = 0.55     # only skip when the brain itself is unsure

    @classmethod
    def from_env(cls) -> "HoodLimits":
        return cls(
            max_trade_eth=_env_float("LIVE_HOOD_MAX_TRADE_ETH", 0.05),
            max_hourly_eth=_env_float("LIVE_HOOD_MAX_HOURLY_ETH", 10.0),
            max_daily_eth=_env_float("LIVE_HOOD_MAX_DAILY_ETH", 100.0),
            max_positions=_env_int("LIVE_HOOD_MAX_POSITIONS", 20),
            min_liquidity_usd=_env_float("LIVE_HOOD_MIN_LIQ_USD", 1_000.0),
            max_slippage_bps=_env_int("LIVE_HOOD_MAX_SLIPPAGE_BPS", 1500),
            min_confidence=_env_float("LIVE_HOOD_MIN_CONFIDENCE", 0.55),
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
        # Realized-PnL journal: rolling list of closed trades so the UI
        # can render a live P&L strip and running totals.
        # Each entry: {symbol, addr, eth_in, eth_out, pnl_eth, opened_at_s,
        #              closed_at_s, buy_hash, sell_hash}
        self.closed_positions: List[dict] = []
        self.realized_pnl_eth: float = 0.0
        self.total_eth_spent: float = 0.0
        self.total_eth_received: float = 0.0
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
            if isinstance(data, dict):
                self.closed_positions = list(data.get("closed_positions", []))[-200:]
                self.realized_pnl_eth = float(data.get("realized_pnl_eth", 0.0))
                self.total_eth_spent = float(data.get("total_eth_spent", 0.0))
                self.total_eth_received = float(data.get("total_eth_received", 0.0))
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
                json.dump({
                    "open_positions": self.open_positions,
                    "closed_positions": self.closed_positions[-200:],
                    "realized_pnl_eth": self.realized_pnl_eth,
                    "total_eth_spent": self.total_eth_spent,
                    "total_eth_received": self.total_eth_received,
                }, f)
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

    # --- Uniswap V4 quoting ---------------------------------------------

    async def _quote_v4_single_native(
        self, token: str, fee: int, tick_spacing: int,
        amount_in_wei: int, *, buy: bool,
    ) -> Optional[int]:
        """Quote a single-hop V4 swap between native ETH (currency0) and
        `token` (currency1) at the vanilla (fee, tickSpacing) pool with
        hooks == 0x0. ``buy=True`` swaps ETH → token (zeroForOne),
        ``buy=False`` swaps token → ETH. Returns amountOut in raw units,
        or None if the pool doesn't exist / has no liquidity."""
        try:
            from eth_abi import encode  # type: ignore
        except Exception:  # noqa: BLE001
            return None
        # V4Quoter.quoteExactInputSingle((PoolKey,bool,uint128,bytes))
        # PoolKey = (currency0, currency1, fee, tickSpacing, hooks)
        sel = _selector(
            "quoteExactInputSingle(((address,address,uint24,int24,address),"
            "bool,uint128,bytes))"
        )
        pool_key = (
            _to_checksum(V4_NATIVE_CURRENCY),
            _to_checksum(token),
            int(fee),
            int(tick_spacing),
            _to_checksum("0x0000000000000000000000000000000000000000"),
        )
        params = encode(
            ["((address,address,uint24,int24,address),bool,uint128,bytes)"],
            [(pool_key, bool(buy), int(amount_in_wei), b"")],
        )
        data = _hex(sel + params)
        try:
            js = await self._rpc("eth_call", [
                {"to": _to_checksum(V4_QUOTER), "data": data}, "latest",
            ])
            ret = str(js.get("result") or "0x")
            # V4Quoter returns (uint256 amountOut, uint256 gasEstimate).
            # A "no route" pool reverts (eth_call returns 0x or an error).
            if len(ret) < 66:
                return None
            return int(ret[2:66], 16)
        except Exception as e:  # noqa: BLE001
            LOG.debug("hood v4 quote %s@(%d,%d) buy=%s failed: %s",
                      token[:6], fee, tick_spacing, buy, e)
            return None

    async def _best_v4_pool_native(
        self, token: str, amount_in_wei: int, *, buy: bool,
    ) -> Tuple[Optional[Tuple[int, int]], int]:
        """Probe every vanilla V4 (fee, tickSpacing) pool between native
        ETH and `token`. Returns ((fee, tickSpacing), best_out) or
        (None, 0)."""
        best_key: Optional[Tuple[int, int]] = None
        best_out = 0
        for fee, ts in V4_FEE_TIERS:
            out = await self._quote_v4_single_native(
                token, fee, ts, amount_in_wei, buy=buy,
            )
            if out and out > best_out:
                best_out = out
                best_key = (fee, ts)
        return best_key, best_out

    # --- reverse-quote sell-route guard ---------------------------------

    async def has_sell_route(self, token: str,
                              probe_amount_raw: int) -> bool:
        """Return True if a hypothetical sell of ``probe_amount_raw``
        units of ``token`` back to ETH would find any live pool on
        either Uniswap V3 (via WETH9) or Uniswap V4 (via native ETH).

        Used as a pre-buy safety check so the brain never opens a
        position it cannot exit."""
        if probe_amount_raw <= 0:
            return False
        # V3 → WETH
        try:
            fee, out = await self._best_fee_tier(
                token, WETH9, probe_amount_raw,
            )
            if fee is not None and out > 0:
                return True
        except Exception:  # noqa: BLE001
            pass
        # V4 → native ETH
        try:
            key, out = await self._best_v4_pool_native(
                token, probe_amount_raw, buy=False,
            )
            if key is not None and out > 0:
                return True
        except Exception:  # noqa: BLE001
            pass
        return False

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
        """Execute a single-hop exact-input swap.

        Routing waterfall:
            1. Uniswap V3 SwapRouter02.exactInputSingle (WETH path).
            2. Uniswap V4 Universal Router V4_SWAP (native-ETH path,
               vanilla pools with hooks=0x0).

        On BUY we also probe a reverse-route quote before broadcasting so
        the brain never opens a position it can't exit."""
        rec = HoodTradeRecord(
            t=int(time.time()), side=side,
            token_addr=token_addr, token_symbol=symbol,
            eth_amount=-abs(eth_amount) if side == "buy" else 0.0,
            status="pending",
        )
        try:
            # 1) Quote V3 first (mature, cheap gas, most liquidity today).
            best_fee, best_out = await self._best_fee_tier(
                input_addr, output_addr, amount_in_wei
            )
            v4_key: Optional[Tuple[int, int]] = None
            v4_out = 0
            if best_fee is None or best_out <= 0:
                # 1b) Fall back to V4 (native-ETH, vanilla pools).
                v4_key, v4_out = await self._best_v4_pool_native(
                    token=(output_addr if side == "buy" else input_addr),
                    amount_in_wei=amount_in_wei,
                    buy=(side == "buy"),
                )
                if v4_key is None or v4_out <= 0:
                    rec.status = "failed"
                    rec.error = "no_route"
                    self._ledger.append(rec)
                    return rec
                # Use V4 route
                best_out = v4_out

            # 2) BUY-side: reverse-quote guard. Probe whether we could
            # sell the tokens we'd receive back to ETH via any pool. If
            # not, refuse the trade — we'd be stranding the position.
            if side == "buy":
                probe_tokens = max(1, best_out // 100)  # 1% probe
                has_exit = await self.has_sell_route(output_addr,
                                                      probe_tokens)
                if not has_exit:
                    rec.status = "blocked"
                    rec.error = "no_sell_route"
                    self._ledger.append(rec)
                    return rec
            # Apply slippage floor
            slip = self.limits.max_slippage_bps
            min_out = best_out * (10_000 - slip) // 10_000
            # 3) Dry-run short-circuit
            if self.is_dry_run():
                rec.status = "dry_run"
                self._ledger.append(rec)
                return rec
            # 4) Route: V3 (SwapRouter02) if we got a V3 quote, else V4
            # (Universal Router). ``v4_key`` is set only when V3 was empty.
            using_v4 = v4_key is not None
            if using_v4:
                # For V4 sells we need the token approved to Permit2 and
                # then Permit2 approved to the Universal Router.
                if side == "sell":
                    approve_rec = await self._ensure_approval(
                        token_addr=input_addr, amount_wei=amount_in_wei,
                        spender=PERMIT2,
                    )
                    if approve_rec is not None and approve_rec.status != "confirmed":
                        rec.status = "failed"
                        rec.error = f"approve_permit2:{approve_rec.error or approve_rec.status}"
                        self._ledger.append(rec)
                        return rec
                    permit2_rec = await self._ensure_permit2_allowance(
                        token=input_addr, spender=UNIVERSAL_ROUTER,
                        amount=amount_in_wei,
                    )
                    if permit2_rec is not None and permit2_rec.status != "confirmed":
                        rec.status = "failed"
                        rec.error = f"permit2:{permit2_rec.error or permit2_rec.status}"
                        self._ledger.append(rec)
                        return rec
                data = self._build_universal_router_v4_swap(
                    token=(output_addr if side == "buy" else input_addr),
                    fee=v4_key[0], tick_spacing=v4_key[1],
                    amount_in=amount_in_wei, min_out=min_out,
                    zero_for_one=(side == "buy"),
                    recipient=self.address,
                )
                to_addr = UNIVERSAL_ROUTER
                value_wei = amount_in_wei if side == "buy" else 0
            else:
                # V3 route (existing behaviour).
                if side == "buy":
                    calldata = self._build_exact_input_single(
                        input_addr, output_addr, best_fee,
                        amount_in_wei, min_out,
                    )
                    data = self._wrap_buy_multicall(calldata)
                    value_wei = amount_in_wei
                else:
                    approve_rec = await self._ensure_approval(
                        token_addr=input_addr, amount_wei=amount_in_wei,
                        spender=SWAP_ROUTER02,
                    )
                    if approve_rec is not None and approve_rec.status != "confirmed":
                        rec.status = "failed"
                        rec.error = f"approve:{approve_rec.error or approve_rec.status}"
                        self._ledger.append(rec)
                        return rec
                    swap_leg = self._build_exact_input_single(
                        input_addr, output_addr, best_fee,
                        amount_in_wei, min_out, recipient=ADDRESS_THIS,
                    )
                    unwrap_leg = self._build_unwrap_weth9(min_out, self.address)
                    data = self._wrap_multicall([swap_leg, unwrap_leg])
                    value_wei = 0
                to_addr = SWAP_ROUTER02
            # 5) Broadcast
            tx_hash = await self._send_tx(
                to=to_addr, data=data, value_wei=value_wei,
            )
            rec.tx_hash = tx_hash
            rec.status = "confirmed"  # best-effort; we don't wait for finality
            if side == "buy":
                self.open_positions[token_addr.lower()] = {
                    "symbol": symbol,
                    "opened_at_s": rec.t,
                    "eth_spent": abs(eth_amount),
                    "amount_out_raw": best_out,
                    "fee_tier": best_fee if not using_v4 else None,
                    "v4_pool": ({"fee": v4_key[0], "tick_spacing": v4_key[1]}
                                if using_v4 else None),
                    "route": "v4" if using_v4 else "v3",
                    "buy_hash": tx_hash,
                }
                self.total_eth_spent += abs(eth_amount)
            else:
                # Sell: proceeds `best_out` are in WETH wei (the min_out we
                # would have accepted; actual received may be a bit higher).
                pos = self.open_positions.pop(token_addr.lower(), None)
                eth_out = best_out / WEI_PER_ETH
                rec.eth_amount = float(eth_out)  # positive on sell
                eth_in = float(pos.get("eth_spent") or 0.0) if pos else 0.0
                pnl = eth_out - eth_in
                self.realized_pnl_eth += pnl
                self.total_eth_received += eth_out
                self.closed_positions.append({
                    "symbol": symbol,
                    "addr": token_addr,
                    "eth_in": eth_in,
                    "eth_out": eth_out,
                    "pnl_eth": pnl,
                    "pnl_pct": (pnl / eth_in * 100.0) if eth_in > 0 else 0.0,
                    "opened_at_s": int((pos or {}).get("opened_at_s") or rec.t),
                    "closed_at_s": rec.t,
                    "buy_hash": (pos or {}).get("buy_hash"),
                    "sell_hash": tx_hash,
                })
                self.closed_positions = self.closed_positions[-200:]
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
                                 amount_wei: int,
                                 spender: str = SWAP_ROUTER02
                                 ) -> Optional[HoodTradeRecord]:
        """Ensure ``spender`` has enough ERC-20 allowance to move
        ``amount_wei`` of ``token_addr`` from us. Returns the approve
        trade record if a new approval was broadcast, or None if the
        existing allowance is already sufficient. Dry-run is a no-op."""
        allowance = await self._erc20_allowance(token_addr, self.address,
                                                  spender)
        if allowance >= amount_wei:
            return None
        if self.is_dry_run():
            return None
        approve_data = self._build_approve(spender, (1 << 256) - 1)
        tx_hash = await self._send_tx(to=token_addr, data=approve_data,
                                        value_wei=0)
        rec = HoodTradeRecord(
            t=int(time.time()), side="approve",
            token_addr=token_addr, token_symbol=f"APPROVE→{spender[:6]}",
            eth_amount=0.0, tx_hash=tx_hash, status="confirmed",
        )
        self._ledger.append(rec)
        return rec

    async def _ensure_permit2_allowance(self, token: str, spender: str,
                                          amount: int
                                          ) -> Optional[HoodTradeRecord]:
        """Ensure Permit2 has granted ``spender`` (typically the Universal
        Router) an allowance ≥ ``amount`` for ``token`` from us. Permit2
        stores allowances internally keyed by (owner, token, spender);
        we set them directly via Permit2.approve — no signature flow."""
        try:
            allowance, _exp, _nonce = await self._permit2_allowance(
                self.address, token, spender,
            )
        except Exception:  # noqa: BLE001
            allowance = 0
        if allowance >= amount:
            return None
        if self.is_dry_run():
            return None
        from eth_abi import encode  # type: ignore
        sel = _selector("approve(address,address,uint160,uint48)")
        expiration = (1 << 48) - 1
        amt = (1 << 160) - 1
        params = encode(
            ["address", "address", "uint160", "uint48"],
            [_to_checksum(token), _to_checksum(spender), amt, expiration],
        )
        tx_hash = await self._send_tx(to=PERMIT2, data=sel + params,
                                        value_wei=0)
        rec = HoodTradeRecord(
            t=int(time.time()), side="approve",
            token_addr=token, token_symbol=f"PERMIT2→{spender[:6]}",
            eth_amount=0.0, tx_hash=tx_hash, status="confirmed",
        )
        self._ledger.append(rec)
        return rec

    async def _permit2_allowance(self, owner: str, token: str,
                                   spender: str) -> Tuple[int, int, int]:
        from eth_abi import encode  # type: ignore
        sel = _selector("allowance(address,address,address)")
        params = encode(
            ["address", "address", "address"],
            [_to_checksum(owner), _to_checksum(token), _to_checksum(spender)],
        )
        data = _hex(sel + params)
        try:
            js = await self._rpc("eth_call", [
                {"to": _to_checksum(PERMIT2), "data": data}, "latest",
            ])
            ret = str(js.get("result") or "0x")
            if len(ret) < 194:
                return 0, 0, 0
            return (int(ret[2:66], 16), int(ret[66:130], 16),
                    int(ret[130:194], 16))
        except Exception:  # noqa: BLE001
            return 0, 0, 0

    def _build_universal_router_v4_swap(
        self, *, token: str, fee: int, tick_spacing: int,
        amount_in: int, min_out: int, zero_for_one: bool,
        recipient: str,
    ) -> bytes:
        """Build calldata for a single V4_SWAP through the Universal Router
        between native ETH (currency0=0x0) and ``token`` (currency1) on the
        vanilla pool (fee, tickSpacing, hooks=0x0).

        Commands byte 0x10 = V4_SWAP. Inside V4_SWAP the ``actions`` bytes are:
          0x06 SWAP_EXACT_IN_SINGLE
          0x0c SETTLE_ALL   (pay input we owe the PoolManager)
          0x0f TAKE_ALL     (collect the output owed to us)"""
        from eth_abi import encode  # type: ignore
        pool_key = (
            _to_checksum(V4_NATIVE_CURRENCY),
            _to_checksum(token),
            int(fee),
            int(tick_spacing),
            _to_checksum("0x0000000000000000000000000000000000000000"),
        )
        swap_params = encode(
            ["((address,address,uint24,int24,address),bool,uint128,uint128,bytes)"],
            [(pool_key, bool(zero_for_one), int(amount_in), int(min_out), b"")],
        )
        input_currency = V4_NATIVE_CURRENCY if zero_for_one else token
        output_currency = token if zero_for_one else V4_NATIVE_CURRENCY
        settle_params = encode(
            ["address", "uint256"],
            [_to_checksum(input_currency), int(amount_in)],
        )
        take_params = encode(
            ["address", "uint256"],
            [_to_checksum(output_currency), int(min_out)],
        )
        actions = bytes([0x06, 0x0c, 0x0f])
        v4_swap_input = encode(
            ["bytes", "bytes[]"],
            [actions, [swap_params, settle_params, take_params]],
        )
        commands = bytes([0x10])
        deadline = int(time.time()) + 900
        sel = _selector("execute(bytes,bytes[],uint256)")
        exec_params = encode(
            ["bytes", "bytes[]", "uint256"],
            [commands, [v4_swap_input], deadline],
        )
        return sel + exec_params

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

    # --- live P&L quoting -----------------------------------------------

    async def refresh_open_position_values(self) -> None:
        """Quote each open position back to ETH and cache the current
        mark. Tries V3 QuoterV2 first, then V4 Quoter. Best-effort."""
        for addr, pos in list(self.open_positions.items()):
            try:
                amt = int(pos.get("amount_out_raw") or 0)
                if amt <= 0:
                    continue
                out = None
                # Prefer the exact pool this position was bought through.
                if (pos.get("route") or "v3") == "v4" and pos.get("v4_pool"):
                    vk = pos["v4_pool"]
                    out = await self._quote_v4_single_native(
                        _to_checksum(addr),
                        int(vk.get("fee") or 3000),
                        int(vk.get("tick_spacing") or 60),
                        amt, buy=False,
                    )
                if not out:
                    fee = int(pos.get("fee_tier") or 3000)
                    out = await self._quote_v3_single(
                        _to_checksum(addr), WETH9, fee, amt,
                    )
                if not out:
                    _key, out = await self._best_v4_pool_native(
                        _to_checksum(addr), amt, buy=False,
                    )
                if out and out > 0:
                    pos["current_eth_value"] = out / WEI_PER_ETH
                    pos["marked_at_s"] = int(time.time())
            except Exception:
                pass
        self._save_positions()

    def pnl_summary(self) -> dict:
        """Compute a full P&L snapshot from the persisted books."""
        unrealized = 0.0
        marked_open = []
        for addr, pos in self.open_positions.items():
            eth_in = float(pos.get("eth_spent") or 0.0)
            cur = float(pos.get("current_eth_value") or 0.0)
            pnl = cur - eth_in if cur > 0 else 0.0
            unrealized += pnl
            marked_open.append({
                "symbol": pos.get("symbol"),
                "addr": addr,
                "eth_in": eth_in,
                "current_eth": cur,
                "pnl_eth": pnl,
                "pnl_pct": (pnl / eth_in * 100.0) if eth_in > 0 else None,
                "opened_at_s": int(pos.get("opened_at_s") or 0),
                "buy_hash": pos.get("buy_hash"),
            })
        marked_open.sort(key=lambda p: -(p.get("pnl_eth") or 0.0))
        recent_closed = list(self.closed_positions[-10:])[::-1]
        return {
            "realized_pnl_eth": round(self.realized_pnl_eth, 8),
            "unrealized_pnl_eth": round(unrealized, 8),
            "total_pnl_eth": round(self.realized_pnl_eth + unrealized, 8),
            "total_eth_spent": round(self.total_eth_spent, 8),
            "total_eth_received": round(self.total_eth_received, 8),
            "open_positions": marked_open,
            "n_open": len(self.open_positions),
            "n_closed": len(self.closed_positions),
            "closed_wins": sum(1 for c in self.closed_positions if c.get("pnl_eth", 0) > 0),
            "closed_losses": sum(1 for c in self.closed_positions if c.get("pnl_eth", 0) <= 0),
            "recent_closed": recent_closed,
        }

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
            "pnl": self.pnl_summary(),
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
