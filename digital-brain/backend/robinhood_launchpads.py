"""Robinhood-Chain launchpad classifier.

Given an ERC-20 token address on Robinhood Chain (chainId 4663), decide
whether it was created by a **known bonding-curve launchpad**. Only
tokens that came out of one of these launchpads are considered safe for
the brain to buy — everything else on the chain (a random contract
deployed straight to Uniswap by an unknown EOA) is treated as an
untrusted pool and blocked.

Detection strategy
------------------
Every launchpad we care about deploys the ERC-20 token contract inside
its ``createToken()`` (or equivalent) factory call.  Rather than depend
on an external explorer API (Blockscout on Robinhood Chain is behind
Cloudflare and cannot be scraped from a datacenter), we resolve the
deployer entirely on-chain by walking the token's very first ``mint``
log (a ``Transfer(from=0x0, …)`` event).

Concretely:

  1. ``eth_getLogs`` on the token address, filtered to the ``Transfer``
     topic with ``from == 0x0``.  The oldest matching log is the mint.
  2. ``eth_getTransactionByHash`` on that log's transaction — the tx's
     ``to`` field is either the factory that called ``createToken()``
     or ``null`` when the token was deployed directly (no factory,
     unsafe by construction so we skip it).

The resulting factory address is matched against a small allow-list
published by each launchpad's own docs.  Everything is cached to disk
so a token is only ever classified once.

References
~~~~~~~~~~
* hood.fun launchpad / platform:  Mobula almanac
* dyor.fun launch factory:        Mobula almanac
* Robinlaunch factory v11:        Robinlaunch developer docs
* RobinFun:                       whitepaper (V2 grad, LP burn)

The list is deliberately conservative — we would rather false-negative
(skip a legitimate launch we do not yet recognise) than false-positive
(buy a random attacker-deployed pool).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Dict, Optional


LOG = logging.getLogger("robinhood_launchpads")

# --- Known launchpad factory addresses (lower-case, no 0x prefix stripped) ---
# The comment on each entry cites the source the address was pulled from.
# When a launchpad publishes both a "factory" and a "platform" contract,
# both are listed — either may show up as the token's on-chain creator
# depending on how their createToken() is wired.
KNOWN_LAUNCHPADS: Dict[str, str] = {
    # hood.fun (Mobula: docs.mobula.io/almanac/robinhood-launchpads/hoodfun)
    "0x5fcc1df0dc020cf454e742e9a8ae2554c37a452c": "hood.fun",
    "0xc6a2941b962fb667786d7f4b97f7f965d6f0a4f8": "hood.fun",
    # dyor.fun (Mobula: docs.mobula.io/almanac/robinhood-launchpads/dyorfun)
    "0x80b42aed46d73f47119dc444bea28a9e68f32bf4": "dyor.fun",
    # Pons family (docs.ponsfamily.com, docs.bitquery.io/robinhood/pons-api)
    # V1 factory (legacy, Uniswap V3 one-sided positions)
    "0xa5aab3f0c6eeadf30ef1d3eb997108e976351feb": "pons.v1",
    # V2 factory (emits TokenLaunched, LaunchSwept, PoolGraduated)
    "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e": "pons.v2",
    # V2 launch-and-buy router (createToken + first buy in one tx)
    "0xe33e9e479df8802cb0866d5d05258bec4cf62948": "pons.v2",
    # V2 launch deployer (the internal deployer the factory calls)
    "0x3711cea4feade896c913c68f01eda97cb06d1a42": "pons.v2",
    # V2 graduation executor (finalises pool + migrates liquidity)
    "0xc7819b64a1daecd7ec19856d026cb14efbd89046": "pons.v2",
    # Long.xyz (docs.mobula.io/almanac/robinhood-launchpads/longxyz)
    # Doppler / Airlock-based launchpad, tokens land in Uniswap V4 pools.
    "0x22e99278308b393ea1260859b181ad7e78f5eeed": "long.xyz",
    "0xeb7c034704ef8dcd2d32324c1545f62fb4ad0862": "long.xyz",
    # RobinFun (docs.mobula.io/almanac/robinhood-launchpads/robinfun)
    # Custom bonding-curve AMM, graduates into V2 with permanently-burned LP.
    "0xd861cb5dc71a0171e8f0f6586cadb069f3a35e4d": "robinfun",
    # launchpad.meme (launchpad.meme/api/robinhood/docs)
    # Direct-V3 launch factory, LP permanently locked.
    "0xfb21934bb01b4d7b83beb8af6e6fd553f049e632": "launchpad.meme",
    # The Greenwood (nockterminal.com launchpad registry, first-party form
    # verified). Factory deploys per-launch tokens into Uniswap infra.
    "0x81de990be508b95540b3c519417e7c0755b42977": "greenwood",
    # Robinlaunch (robinlaunch.fun/docs) publishes only truncated prefixes
    # in its HTML ("0x700D…4994", "0xF3b3…E079", "0x9F1A…C6fF",
    # "0xA510…27a5"). Add the full addresses via the
    # ROBINHOOD_LAUNCHPAD_ALLOWLIST env var once verified on Blockscout,
    # e.g. `0x700D...4994:robinlaunch,0xF3b3...E079:robinlaunch`.
}

# Env override so operators can extend the allow-list without a code push.
# Format: "0xADDR:name,0xADDR:name" (case-insensitive).
_ENV_EXTRA = os.getenv("ROBINHOOD_LAUNCHPAD_ALLOWLIST", "").strip()
if _ENV_EXTRA:
    for _item in _ENV_EXTRA.split(","):
        _item = _item.strip()
        if not _item:
            continue
        if ":" in _item:
            _a, _n = _item.split(":", 1)
        else:
            _a, _n = _item, "custom"
        _a = _a.strip().lower()
        if _a.startswith("0x") and len(_a) == 42:
            KNOWN_LAUNCHPADS[_a] = _n.strip() or "custom"

DEFAULT_RPC = os.getenv(
    "ROBINHOOD_RPC_URL",
    "https://rpc.mainnet.chain.robinhood.com",
).rstrip("/")

# keccak("Transfer(address,address,uint256)")
_TRANSFER_TOPIC = (
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
)
_ZERO_TOPIC = "0x" + "00" * 32


@dataclass
class LaunchpadClassification:
    """Result of a single classification pass."""
    launchpad: Optional[str]        # None = not from any known launchpad
    creator: Optional[str]          # on-chain deployer address
    checked_at_s: int
    error: Optional[str] = None     # populated when lookup failed


class RobinhoodLaunchpadClassifier:
    """Async, disk-cached classifier."""

    def __init__(self, cache_path: Optional[str] = None,
                 rpc_url: str = DEFAULT_RPC):
        self.rpc_url = rpc_url
        self._cache_path = cache_path or os.path.join(
            os.getenv("DATA_DIR", "./data"),
            "robinhood_launchpad_cache.json",
        )
        self._cache: Dict[str, dict] = {}
        self._lock = asyncio.Lock()
        self._http = None
        self._load_cache()

    # --- persistence ---------------------------------------------------

    def _load_cache(self) -> None:
        try:
            with open(self._cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                self._cache = {k.lower(): v for k, v in data.items()
                               if isinstance(v, dict)}
                LOG.info("loaded %d cached launchpad classifications",
                         len(self._cache))
        except FileNotFoundError:
            pass
        except Exception as e:  # noqa: BLE001
            LOG.warning("failed to load launchpad cache: %s", e)

    def _save_cache(self) -> None:
        try:
            os.makedirs(os.path.dirname(self._cache_path) or ".", exist_ok=True)
            tmp = self._cache_path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self._cache, f)
            os.replace(tmp, self._cache_path)
        except Exception as e:  # noqa: BLE001
            LOG.warning("failed to persist launchpad cache: %s", e)

    # --- http ----------------------------------------------------------

    async def _client(self):
        if self._http is None:
            import httpx  # type: ignore
            self._http = httpx.AsyncClient(timeout=15.0)
        return self._http

    async def close(self) -> None:
        if self._http is not None:
            try:
                await self._http.aclose()
            except Exception:  # noqa: BLE001
                pass
            self._http = None

    # --- classification ------------------------------------------------

    async def classify(self, token_addr: str) -> LaunchpadClassification:
        """Return the launchpad name for ``token_addr``, or None if the
        token was not deployed by any known launchpad. Cached forever
        on the successful path; retried later on error."""
        if not token_addr or not token_addr.startswith("0x"):
            return LaunchpadClassification(
                launchpad=None, creator=None,
                checked_at_s=int(time.time()),
                error="bad_address",
            )
        key = token_addr.lower()
        def _terminal(err: Optional[str]) -> bool:
            # These outcomes are stable properties of the token contract
            # itself; no point re-querying them.
            return err in (None, "eoa_deploy", "no_mint_log", "bad_address")

        if key in self._cache:
            c = self._cache[key]
            # Terminal outcomes stick forever; transient errors (RPC
            # timeouts etc.) get retried once every 10 minutes.
            if _terminal(c.get("error")) or (time.time() - c.get("checked_at_s", 0)) < 600:
                return LaunchpadClassification(
                    launchpad=c.get("launchpad"),
                    creator=c.get("creator"),
                    checked_at_s=int(c.get("checked_at_s", 0)),
                    error=c.get("error"),
                )
        async with self._lock:
            if key in self._cache:
                c = self._cache[key]
                if _terminal(c.get("error")) or (time.time() - c.get("checked_at_s", 0)) < 600:
                    return LaunchpadClassification(
                        launchpad=c.get("launchpad"),
                        creator=c.get("creator"),
                        checked_at_s=int(c.get("checked_at_s", 0)),
                        error=c.get("error"),
                    )
            creator, err = await self._fetch_creator(token_addr)
            launchpad: Optional[str] = None
            if creator:
                launchpad = KNOWN_LAUNCHPADS.get(creator.lower())
            entry = {
                "launchpad": launchpad,
                "creator": creator,
                "checked_at_s": int(time.time()),
                "error": err,
            }
            self._cache[key] = entry
            self._save_cache()
            return LaunchpadClassification(
                launchpad=launchpad,
                creator=creator,
                checked_at_s=entry["checked_at_s"],
                error=err,
            )

    async def _rpc(self, method: str, params: list) -> dict:
        http = await self._client()
        r = await http.post(self.rpc_url, json={
            "jsonrpc": "2.0", "id": int(time.time() * 1000) & 0xffff,
            "method": method, "params": params,
        })
        r.raise_for_status()
        return r.json()

    async def _fetch_creator(self, addr: str) -> tuple[Optional[str], Optional[str]]:
        """Resolve the token's on-chain deployer by walking its very
        first ``Transfer(from=0x0)`` log. Returns ``(creator_lower, error)``.

        ``creator`` is the factory contract that called ``createToken``
        (from the tx's ``to`` field). When the token was deployed
        directly (no factory) ``tx.to`` is null — we surface that as
        ``eoa_deploy`` because every launchpad we support routes through
        a factory."""
        try:
            js = await self._rpc("eth_getLogs", [{
                "address": addr,
                "topics": [_TRANSFER_TOPIC, _ZERO_TOPIC],
                "fromBlock": "0x0",
                "toBlock": "latest",
            }])
        except Exception as e:  # noqa: BLE001
            return None, f"rpc_logs:{type(e).__name__}"
        if "error" in js and js["error"]:
            return None, f"rpc_logs:{(js['error'] or {}).get('message', '?')[:40]}"
        logs = js.get("result") or []
        if not isinstance(logs, list) or not logs:
            return None, "no_mint_log"
        try:
            first = min(logs, key=lambda x: (
                int(x.get("blockNumber", "0x0"), 16),
                int(x.get("logIndex", "0x0"), 16),
            ))
        except Exception:  # noqa: BLE001
            first = logs[0]
        tx_hash = first.get("transactionHash")
        if not tx_hash:
            return None, "no_tx_hash"
        try:
            js2 = await self._rpc("eth_getTransactionByHash", [tx_hash])
        except Exception as e:  # noqa: BLE001
            return None, f"rpc_tx:{type(e).__name__}"
        tx = js2.get("result") or {}
        to = tx.get("to")
        if to is None or to == "0x" or (isinstance(to, str) and to.lower() == "0x0000000000000000000000000000000000000000"):
            # Direct contract deployment — no factory. Not a launchpad.
            frm = (tx.get("from") or "").lower() or None
            return frm, "eoa_deploy"
        return str(to).lower(), None

    # --- introspection -------------------------------------------------

    def cached_snapshot(self) -> dict:
        counts: Dict[str, int] = {}
        for _addr, c in self._cache.items():
            k = c.get("launchpad") or ("error" if c.get("error") else "unknown_deployer")
            counts[k] = counts.get(k, 0) + 1
        return {
            "total_classified": len(self._cache),
            "counts": counts,
            "known_launchpad_factories": len(KNOWN_LAUNCHPADS),
        }

    def token_labels(self) -> Dict[str, str]:
        """Return a fast address→launchpad map (only tokens with a known
        launchpad; unknown/error entries are omitted). Suitable for
        exposing on the trading snapshot so the UI can badge each row."""
        return {addr: c["launchpad"]
                for addr, c in self._cache.items()
                if c.get("launchpad")}
