"""TradingService — the loop that turns the digital brain into a paper trader.

Runs three coroutines concurrently:

  * ``trending_loop``: keep a fresh list of hot Solana meme tokens.
  * ``wallet_loop``: track configured wallets, feed every new observed
    buy/sell to the Trader Cortex as a behavior-cloning label.
  * ``decision_loop``: every N seconds, ask the Trader Cortex for a
    decision on each hot token, execute paper trades, close positions
    that hit take-profit / stop-loss, and feed realized PnL back as an
    RL update.

Trading events also flow into the Brain's thought stream so the user sees
"buy WIF" / "copied BONK sell from wallet ABCD" / "paper +$120 on POPCAT"
side by side with grid-world thoughts.

Not implemented yet: real on-chain execution. That's Phase 4 — see README.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Dict, List, Optional

import torch

from .brain import Brain
from .brain.regions.trader_cortex import (
    ACTION_NAMES as TRADER_ACTION_NAMES,
    ACTION_NAMES_ZH as TRADER_ACTION_NAMES_ZH,
    BUY, HOLD, SELL,
)
from .market import (
    DexScreenerClient,
    TrendingTokenWatcher,
    WalletWatcher,
    Leaderboard,
    WalletDiscovery,
    market_features_from_pair,
)
from .paper_trader import PaperTrader
from .persistence import Persistence
from .solana_executor import build_from_env as build_live_executor
from .robinhood_executor import build_from_env as build_hood_executor


LOG = logging.getLogger("trading_service")


# ---------- Default seed wallets ---------------------------------------------------
# Start empty. The user adds real wallets they trust via the UI or via the
# ``TRACK_WALLETS='addr:label,addr:label'`` env var. We deliberately don't
# ship "hot alpha wallet" defaults — those go stale within days and picking
# them for someone is basically making a bet on their behalf.
DEFAULT_SEED_WALLETS: List[tuple] = []


def _parse_env_wallets() -> List[tuple]:
    """Parse TRACK_WALLETS='addr1:label1,addr2:label2,addr3' from env."""
    raw = os.getenv("TRACK_WALLETS", "").strip()
    if not raw:
        return []
    out: List[tuple] = []
    for item in raw.split(","):
        item = item.strip()
        if not item:
            continue
        if ":" in item:
            addr, label = item.split(":", 1)
        else:
            addr, label = item, ""
        addr = addr.strip()
        label = label.strip()
        if addr:
            out.append((addr, label))
    return out


class TradingService:
    def __init__(self, brain: Brain,
                 start_usd: float = 10_000.0,
                 decision_interval: float = 20.0,
                 trending_interval: float = 60.0,
                 wallet_poll_interval: float = 25.0,
                 discovery_interval: float = 180.0,
                 target_tracked_wallets: int = 20,
                 persistence_dir: Optional[str] = None):
        self.brain = brain
        self.dexscreener = DexScreenerClient()
        self.tokens = TrendingTokenWatcher(
            client=self.dexscreener,
            refresh_interval=trending_interval,
        )
        self.wallets = WalletWatcher(poll_interval=wallet_poll_interval)
        self.leaderboard = Leaderboard()
        self.discovery = WalletDiscovery(
            scan_interval=discovery_interval,
            target_tracked=target_tracked_wallets,
        )
        self.target_tracked_wallets = target_tracked_wallets
        self.paper = PaperTrader(start_usd=start_usd)
        self.persistence = Persistence(persistence_dir or os.getenv("DATA_DIR", "./data"))
        # Live executor is built once at startup from BRAIN_SOL_PRIVKEY.
        # If the key is missing or malformed, `live` stays None and the
        # rest of the service happily runs in paper-only mode.
        self.live = build_live_executor()
        # Robinhood-Chain live executor.  Same key material (the EVM key
        # is deterministically derived from BRAIN_SOL_PRIVKEY inside the
        # executor), separate wallet, separate hard limits, separate
        # ledger.  Runs in parallel to `self.live` on HOOD-chain tokens.
        self.hood = build_hood_executor()

        self.decision_interval = decision_interval
        self.discovery_interval = discovery_interval
        self.take_profit_pct = 0.35     # +35% take profit
        self.stop_loss_pct = -0.18      # -18% stop loss
        self.max_hold_hours = 12.0
        self._trader_events: List[dict] = []
        self._max_events = 80
        self._tasks: List[asyncio.Task] = []
        self._stop = asyncio.Event()
        self._last_save = 0.0
        # Anti-flapping: don't re-add a wallet we already pruned inside this
        # process for 24h.
        self._pruned_until: Dict[str, float] = {}
        # Latest intent computed by the trader cortex for the hottest token
        # each decision tick. Powers the "About to do" hero card.
        self._latest_intent: Optional[dict] = None
        # Web-embodiment reference: injected by the server after boot so
        # the trader can widen its candidate pool with tokens actually
        # seen on real web pages, not just DexScreener's API firehose.
        self._web = None
        self._web_seen_addrs: set = set()  # dedup: which mints we've already logged
        # Fresh-launch dedup: which pump.fun mints we've already reasoned
        # about at least once, so we don't spam "explore" thoughts.
        self._explored_fresh_mints: set = set()

        # Seed wallets (default + env-configured) — always source=env
        for addr, label in DEFAULT_SEED_WALLETS + _parse_env_wallets():
            self.wallets.track(addr, label, source="env")
            self.leaderboard.set_label(addr, label)

        # Restore any prior state. We restore the WHOLE brain (PFC,
        # hippocampus, amygdala, NAcc, lifetime counters) plus the
        # trader cortex + paper trader — so a pod restart is truly
        # invisible to the brain's learning history.
        restored = self.persistence.load_into(
            brain=self.brain,
            trader_cortex=self.brain.trader_cortex,
            paper_trader=self.paper,
        )
        if restored:
            self._push_event(
                "info",
                "Restored prior brain and paper-book from disk.",
                "从磁盘恢复了之前的大脑和 paper 账本。",
            )

    # ------------------------------------------------------------------
    def attach_web_embodiment(self, web) -> None:
        """Wire in the ``WebEmbodiment`` so the trading loop can pull in
        tokens the brain has actually SEEN on a real web page (rather
        than just fetched via the DexScreener REST API).

        We push a one-shot event whenever a new mint address appears on
        one of the tour pages — good context for the user watching the
        trader panel.
        """
        self._web = web

    def _drain_web_sightings(self) -> None:
        """Log any newly-spotted mint addresses from the web tour into
        the event stream so the user sees them show up in real time."""
        if self._web is None:
            return
        snap = self._web.snapshot() or {}
        latest = snap.get("latest") or {}
        site = latest.get("site_name") or "web"
        for t in (latest.get("tokens") or []):
            addr = t.get("address")
            if not addr or addr in self._web_seen_addrs:
                continue
            # Only announce base58-looking mints (25+ char), skip site slugs.
            if len(addr) < 25:
                self._web_seen_addrs.add(addr)  # still dedup, just don't announce
                continue
            self._web_seen_addrs.add(addr)
            sym = t.get("symbol") or "?"
            hint = (t.get("change_hint") or "").strip()
            self._push_event(
                "web_sighting",
                f"[web:{site}] spotted ${sym}{(' ' + hint) if hint else ''} · "
                f"{addr[:4]}…{addr[-4:]}",
                f"[web:{site}] 看到 ${sym}{(' ' + hint) if hint else ''} · "
                f"{addr[:4]}…{addr[-4:]}",
                extra={"symbol": sym, "mint": addr,
                       "site_name": site, "change_hint": hint,
                       "text": t.get("text", "")},
            )

    async def start(self) -> None:
        if self._tasks:
            return
        self._stop.clear()
        await self.tokens.start()
        await self.wallets.start()
        self._tasks = [
            asyncio.create_task(self._decision_loop(), name="td-decisions"),
            asyncio.create_task(self._sol_price_loop(), name="td-solprice"),
            asyncio.create_task(self._discovery_loop(), name="td-discovery"),
        ]
        if self.live is not None:
            self._tasks.append(asyncio.create_task(
                self._live_balance_loop(), name="td-live-balance",
            ))
        if self.hood is not None:
            self._tasks.append(asyncio.create_task(
                self._hood_balance_loop(), name="td-hood-balance",
            ))
            self._push_event(
                "live_ready",
                f"live executor armed · wallet {self.live.pubkey_str[:4]}…"
                f"{self.live.pubkey_str[-4:]} · caps "
                f"{self.live.limits.max_trade_sol:.4f}/trade "
                f"{self.live.limits.max_daily_sol:.4f}/day",
                f"链上执行已上线 · 钱包 {self.live.pubkey_str[:4]}…"
                f"{self.live.pubkey_str[-4:]} · 单笔上限 "
                f"{self.live.limits.max_trade_sol:.4f} SOL / 每日 "
                f"{self.live.limits.max_daily_sol:.4f} SOL",
            )

    async def stop(self) -> None:
        self._stop.set()
        await self.tokens.stop()
        await self.wallets.stop()
        for t in self._tasks:
            t.cancel()
        for t in self._tasks:
            try:
                await t
            except (asyncio.CancelledError, Exception):
                pass
        self._tasks = []
        if self.live is not None:
            try:
                await self.live.close()
            except Exception:  # noqa: BLE001
                pass
        if self.hood is not None:
            try:
                await self.hood.close()
            except Exception:  # noqa: BLE001
                pass
        self._save_now()

    async def _live_buy(self, mint: str, symbol: str,
                         liquidity_usd: float, confidence: float) -> None:
        """Fire a real on-chain buy alongside the paper leg. All safety
        gates live inside the executor; we just log the outcome so the
        thought stream reflects what actually happened."""
        if self.live is None:
            return
        rec = await self.live.buy(
            output_mint=mint, symbol=symbol,
            sol_amount=self.live.limits.max_trade_sol,
            liquidity_usd=liquidity_usd, confidence=confidence,
        )
        self._push_live_event(rec)

    async def _live_sell(self, mint: str, symbol: str, liquidity_usd: float) -> None:
        if self.live is None:
            return
        pos = self.live.open_positions.get(mint)
        if not pos:
            return
        # We saved the exact raw token amount Jupiter told us the buy would
        # yield. Feed that back in as the sell input. If the on-chain
        # balance is slightly less (due to rent/fees rounding), the sell
        # will still route — Jupiter picks the best partial fill within
        # our slippage cap.
        raw = int(pos.get("out_amount_raw") or 0)
        if raw <= 0:
            # Nothing we can safely close from bookkeeping alone.
            self._push_event(
                "live_skip_sell",
                f"[live] skipped SELL {symbol}: no out_amount recorded",
                f"[链上] 跳过卖出 {symbol}：未记录持仓数量",
            )
            self.live.open_positions.pop(mint, None)
            return
        rec = await self.live.sell(
            input_mint=mint, symbol=symbol,
            token_amount_raw=raw,
            liquidity_usd=liquidity_usd,
        )
        self._push_live_event(rec)

    def _push_live_event(self, rec) -> None:
        sig_short = (rec.tx_sig[:6] + "…" + rec.tx_sig[-4:]) if rec.tx_sig else "—"
        if rec.status == "confirmed":
            self._push_event(
                "live_trade",
                f"[live] {rec.side.upper()} {rec.token_symbol} · sig {sig_short}",
                f"[链上] {'买入' if rec.side == 'buy' else '卖出'} {rec.token_symbol} · 签名 {sig_short}",
                extra={"symbol": rec.token_symbol, "mint": rec.token_mint,
                       "side": rec.side, "tx_sig": rec.tx_sig,
                       "sol_amount": rec.sol_amount},
            )
        elif rec.status == "blocked":
            self._push_event(
                "live_blocked",
                f"[live] blocked {rec.side.upper()} {rec.token_symbol} · {rec.error}",
                f"[链上] 拦截 {'买入' if rec.side == 'buy' else '卖出'} {rec.token_symbol} · {rec.error}",
                extra={"symbol": rec.token_symbol, "mint": rec.token_mint,
                       "side": rec.side, "reason": rec.error},
            )
        elif rec.status == "dry_run":
            self._push_event(
                "live_dry_run",
                f"[live·dry] would {rec.side.upper()} {rec.token_symbol}",
                f"[链上·演练] 计划{'买入' if rec.side == 'buy' else '卖出'} {rec.token_symbol}",
                extra={"symbol": rec.token_symbol, "mint": rec.token_mint,
                       "side": rec.side},
            )
        elif rec.status == "failed":
            self._push_event(
                "live_failed",
                f"[live] failed {rec.side.upper()} {rec.token_symbol}: {rec.error}",
                f"[链上] 失败 {'买入' if rec.side == 'buy' else '卖出'} {rec.token_symbol}：{rec.error}",
                extra={"symbol": rec.token_symbol, "mint": rec.token_mint,
                       "side": rec.side, "error": rec.error},
            )

    async def _live_balance_loop(self) -> None:
        """Poll the on-chain wallet's SOL balance so the UI has a fresh
        number to render. Cheap RPC call; runs every ~30 s."""
        if self.live is None:
            return
        while not self._stop.is_set():
            try:
                await self.live.refresh_sol_balance()
            except Exception as e:  # noqa: BLE001
                LOG.debug("live balance refresh failed: %s", e)
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=30.0)
            except asyncio.TimeoutError:
                pass

    # ------------------------------------------------------------------
    # Robinhood-Chain live execution mirror (EVM L2 via Uniswap V3).
    # ------------------------------------------------------------------

    async def _hood_buy(self, token_addr: str, symbol: str,
                          liquidity_usd: float, confidence: float) -> None:
        if self.hood is None:
            return
        rec = await self.hood.buy(
            output_token=token_addr, symbol=symbol,
            eth_amount=self.hood.limits.max_trade_eth,
            liquidity_usd=liquidity_usd, confidence=confidence,
        )
        self._push_hood_event(rec)

    async def _hood_sell(self, token_addr: str, symbol: str,
                           liquidity_usd: float) -> None:
        if self.hood is None:
            return
        pos = self.hood.open_positions.get(token_addr.lower())
        if not pos:
            return
        raw = int(pos.get("amount_out_raw") or 0)
        if raw <= 0:
            self._push_event(
                "hood_skip_sell",
                f"[hood] skipped SELL {symbol}: no amount recorded",
                f"[HOOD] 跳过卖出 {symbol}：未记录持仓数量",
            )
            self.hood.open_positions.pop(token_addr.lower(), None)
            return
        rec = await self.hood.sell(
            input_token=token_addr, symbol=symbol,
            amount_in_wei=raw, liquidity_usd=liquidity_usd,
        )
        self._push_hood_event(rec)

    def _push_hood_event(self, rec) -> None:
        sig_short = (rec.tx_hash[:6] + "…" + rec.tx_hash[-4:]) if rec.tx_hash else "—"
        if rec.status == "confirmed":
            self._push_event(
                "hood_trade",
                f"[hood] {rec.side.upper()} {rec.token_symbol} · tx {sig_short}",
                f"[HOOD] {'买入' if rec.side == 'buy' else '卖出'} {rec.token_symbol} · 交易 {sig_short}",
                extra={"symbol": rec.token_symbol, "mint": rec.token_addr,
                       "chain": "robinhood", "side": rec.side,
                       "tx_hash": rec.tx_hash, "eth_amount": rec.eth_amount},
            )
        elif rec.status == "blocked":
            self._push_event(
                "hood_blocked",
                f"[hood] blocked {rec.side.upper()} {rec.token_symbol} · {rec.error}",
                f"[HOOD] 拦截 {'买入' if rec.side == 'buy' else '卖出'} {rec.token_symbol} · {rec.error}",
                extra={"symbol": rec.token_symbol, "mint": rec.token_addr,
                       "chain": "robinhood", "side": rec.side,
                       "reason": rec.error},
            )
        elif rec.status == "dry_run":
            self._push_event(
                "hood_dry_run",
                f"[hood·dry] would {rec.side.upper()} {rec.token_symbol}",
                f"[HOOD·演练] 计划{'买入' if rec.side == 'buy' else '卖出'} {rec.token_symbol}",
                extra={"symbol": rec.token_symbol, "mint": rec.token_addr,
                       "chain": "robinhood", "side": rec.side},
            )
        elif rec.status == "failed":
            self._push_event(
                "hood_failed",
                f"[hood] failed {rec.side.upper()} {rec.token_symbol}: {rec.error}",
                f"[HOOD] 失败 {'买入' if rec.side == 'buy' else '卖出'} {rec.token_symbol}：{rec.error}",
                extra={"symbol": rec.token_symbol, "mint": rec.token_addr,
                       "chain": "robinhood", "side": rec.side,
                       "error": rec.error},
            )

    async def _hood_balance_loop(self) -> None:
        """Poll the HOOD wallet's ETH balance every ~30 s so the UI has a
        fresh number to render."""
        if self.hood is None:
            return
        while not self._stop.is_set():
            try:
                await self.hood.refresh_eth_balance()
            except Exception as e:  # noqa: BLE001
                LOG.debug("hood balance refresh failed: %s", e)
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=30.0)
            except asyncio.TimeoutError:
                pass

    # ------------------------------------------------------------------

    # ------------------------------------------------------------------
    # Auto-discovery: pull smart-money candidates from pumping tokens on-chain.
    # ------------------------------------------------------------------

    async def _discovery_loop(self) -> None:
        """Every ``discovery_interval`` seconds, look at pumping hot tokens,
        find their top on-chain holders, and start tracking new candidates.
        Also prunes ``auto``-sourced wallets that have been dead weight for
        a while (protects ``user`` / ``env`` wallets from ever getting
        removed automatically)."""
        # Wait a bit so the trending watcher has data.
        try:
            await asyncio.wait_for(self._stop.wait(), timeout=25.0)
        except asyncio.TimeoutError:
            pass
        while not self._stop.is_set():
            try:
                await self._discovery_tick()
            except Exception as e:  # noqa: BLE001
                LOG.warning("discovery tick failed: %s", e)
            try:
                await asyncio.wait_for(self._stop.wait(),
                                       timeout=self.discovery_interval)
            except asyncio.TimeoutError:
                pass

    async def _discovery_tick(self) -> None:
        # 1) Prune before we discover more, so freshly-freed slots can be filled.
        pruned = self._prune_dead_weight()

        # 2) Only discover if we're below the target.
        current = self.wallets.wallets_with_meta()
        current_addrs = set(current.keys())
        if len(current_addrs) >= self.target_tracked_wallets:
            LOG.debug("discovery: at target (%d), skipping scan", len(current_addrs))
            return
        need = self.target_tracked_wallets - len(current_addrs)

        # 3) Scan the top hot tokens for new candidates.
        hot = self.tokens.snapshot()
        if not hot:
            return
        skip_set = current_addrs | {w for w, until in self._pruned_until.items()
                                    if until > time.time()}
        discovered = await self.discovery.scan(hot, skip_set)
        if not discovered:
            return

        # 4) Add up to ``need`` of them.
        added = 0
        for d in discovered:
            if added >= need:
                break
            label = f"early on ${d.source_token_symbol}"
            if self.wallets.track(d.wallet, label, source="auto", extra={
                "source_token_symbol": d.source_token_symbol,
                "source_token_mint": d.source_token_mint,
                "source_token_pump_pct_24h": d.source_token_pump_pct_24h,
                "discovered_at_s": d.discovered_at_s,
            }):
                self.leaderboard.set_label(d.wallet, label)
                self._push_event(
                    "discover",
                    f"auto-discovered wallet {d.wallet[:4]}…{d.wallet[-4:]} — "
                    f"top holder of ${d.source_token_symbol} "
                    f"({d.source_token_pump_pct_24h:+.0f}% 24h)",
                    f"自动挖到钱包 {d.wallet[:4]}…{d.wallet[-4:]} — "
                    f"${d.source_token_symbol} 早期大户"
                    f"（24h {d.source_token_pump_pct_24h:+.0f}%）",
                    extra={"wallet": d.wallet,
                           "symbol": d.source_token_symbol,
                           "pump_pct_24h": d.source_token_pump_pct_24h},
                )
                added += 1
        if added:
            LOG.info("discovery added %d new wallets (pruned=%d, tracked=%d/%d)",
                     added, pruned, len(self.wallets.wallets()),
                     self.target_tracked_wallets)

    def _prune_dead_weight(self) -> int:
        """Remove ``auto``-sourced wallets that are proving to be junk.

        A wallet is dead weight if:
            - source == "auto", AND
            - has been tracked > 90 minutes, AND
            - (has produced 0 observed trades OR has realized_pnl_usd < -50)
        """
        now = time.time()
        pruned = 0
        for wallet, meta in list(self.wallets.wallets_with_meta().items()):
            if meta.get("source") != "auto":
                continue
            age_min = (now - float(meta.get("added_at", now))) / 60.0
            if age_min < 90:
                continue
            trades = self.wallets.trades_of(wallet, limit=50)
            board = self.leaderboard.get(wallet)
            no_activity = len(trades) == 0
            deep_loss = board.realized_pnl_usd < -50.0
            if not (no_activity or deep_loss):
                continue
            self.wallets.untrack(wallet)
            self._pruned_until[wallet] = now + 24 * 3600  # cool-down 24h
            reason = "no trades" if no_activity else f"PnL {board.realized_pnl_usd:.0f}"
            self._push_event(
                "prune",
                f"pruned {wallet[:4]}…{wallet[-4:]} ({reason})",
                f"淘汰 {wallet[:4]}…{wallet[-4:]}（{reason}）",
                extra={"wallet": wallet, "reason": reason},
            )
            pruned += 1
        return pruned

    # ------------------------------------------------------------------

    def _push_event(self, kind: str, text_en: str, text_zh: str, extra: Optional[dict] = None):
        ev = {
            "t": int(time.time()),
            "kind": kind,
            "text": text_en,
            "text_zh": text_zh,
        }
        if extra:
            ev["extra"] = extra
        self._trader_events.append(ev)
        if len(self._trader_events) > self._max_events:
            self._trader_events[:] = self._trader_events[-self._max_events:]
        try:
            self.brain._add_thought("trader_cortex", text_en, text_zh, kind=kind,
                                    extra=extra or {})
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Loops
    # ------------------------------------------------------------------

    async def _sol_price_loop(self) -> None:
        """Keep an eye on the SOL/USD price so we can dollar-ize on-chain amounts."""
        while not self._stop.is_set():
            try:
                pairs = await self.dexscreener.search_pairs("SOL/USDC")
                usdc_pairs = [
                    p for p in pairs
                    if p.chain == "solana"
                    and p.base_symbol in ("SOL", "WSOL")
                    and p.price_usd > 1
                ]
                if usdc_pairs:
                    price = float(max(usdc_pairs, key=lambda p: p.liquidity_usd).price_usd)
                    if price > 0:
                        self.wallets.set_sol_usd(price)
            except Exception as e:  # noqa: BLE001
                LOG.debug("sol price refresh failed: %s", e)
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=120.0)
            except asyncio.TimeoutError:
                pass

    async def _decision_loop(self) -> None:
        # Wait a beat for first data
        try:
            await asyncio.wait_for(self._stop.wait(), timeout=6.0)
        except asyncio.TimeoutError:
            pass
        while not self._stop.is_set():
            try:
                await self._decision_tick()
            except Exception as e:  # noqa: BLE001
                LOG.warning("decision tick failed: %s", e)
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.decision_interval)
            except asyncio.TimeoutError:
                pass

    # ------------------------------------------------------------------

    async def _decision_tick(self) -> None:
        # 0) Log any newly-seen web-embodiment sightings.
        self._drain_web_sightings()

        # 1) Ingest any new expert wallet trades → behavior cloning
        new_trades = self.wallets.recent_trades(limit=20)
        self.leaderboard.ingest(new_trades)
        await self._imitate_wallet_trades(new_trades)

        # 2) Grab latest hot tokens
        hot = self.tokens.snapshot()
        if not hot:
            return

        # 3) Update mark-to-market for held positions
        prices: Dict[str, float] = {}
        for p in hot:
            if p.price_usd > 0:
                prices[p.base_address] = p.price_usd
        # For held tokens not in the trending set, keep last known entry price
        for mint, pos in self.paper.positions.items():
            prices.setdefault(mint, pos.entry_price_usd)

        self.paper.note_equity(prices)

        # 4) Auto stop-loss / take-profit / time-exit on current positions
        for mint in list(self.paper.positions.keys()):
            pos = self.paper.positions[mint]
            price_now = prices.get(mint, pos.entry_price_usd)
            if price_now <= 0:
                continue
            live_pnl_pct = (price_now * pos.qty_tokens - pos.usd_size) / max(pos.usd_size, 1e-3)
            hold_hours = (time.time() - pos.entry_at_s) / 3600.0
            reason = None
            if live_pnl_pct >= self.take_profit_pct:
                reason = f"take_profit_{live_pnl_pct * 100:.0f}%"
            elif live_pnl_pct <= self.stop_loss_pct:
                reason = f"stop_loss_{live_pnl_pct * 100:.0f}%"
            elif hold_hours >= self.max_hold_hours:
                reason = f"time_exit_{hold_hours:.1f}h"
            if reason:
                closed = self.paper.try_sell(mint, price_now, reason=reason)
                if closed:
                    self._on_position_closed(closed)

        # 5) Ask the Trader Cortex for a decision on each candidate token.
        # Candidate rules:
        #   * Fresh pump.fun launches ALWAYS make the cut (that's the whole
        #     point — we don't wait for them to develop a 1h price history
        #     before the brain gets to look at them). Even a $2k-liquidity
        #     coin is interesting, we just won't buy it.
        #   * Established pairs need >= $20K liquidity AND at least a 1%
        #     move in the last hour, otherwise it's not worth compute.
        def _is_candidate(p) -> bool:
            if self.tokens.is_fresh_launch(p.base_address):
                return True
            return p.liquidity_usd >= 20_000 and abs(p.price_change_h1) >= 1.0

        candidates = [p for p in hot if _is_candidate(p)]
        # Fresh launches first — we want the brain to LOOK at them ahead of
        # older stuff.
        candidates.sort(key=lambda p: 0 if self.tokens.is_fresh_launch(p.base_address) else 1)
        best_intent: Optional[dict] = None
        for p in candidates[:16]:
            if p.price_usd <= 0:
                continue
            is_fresh = self.tokens.is_fresh_launch(p.base_address)
            feats = market_features_from_pair(p)
            hints = torch.tensor(
                self.paper.hint_vector_for(p.base_address, p.price_usd),
                dtype=torch.float32,
            )
            action, log_prob, probs, value = self.brain.trader_cortex.decide(
                feats, hints, temperature=1.0,
            )
            conf = self.brain.trader_cortex.last_confidence
            probs_list = [round(float(x), 3) for x in probs.tolist()]
            action_name = TRADER_ACTION_NAMES[action]
            action_name_zh = TRADER_ACTION_NAMES_ZH[action]

            # First time we look at a fresh launch → emit an "explore"
            # thought so the user sees the brain scanning new projects
            # (not just reasoning about the same old memes) AND grow the
            # brain's knowledge bank so it has a permanent memory of this
            # token from the moment it first sees it.
            if is_fresh and p.base_address not in self._explored_fresh_mints:
                self._explored_fresh_mints.add(p.base_address)
                meta = self.tokens.fresh_launch_meta(p.base_address)
                age_min = meta.age_minutes if meta else 0.0
                mcap = meta.usd_market_cap if meta else (p.market_cap or 0.0)
                pad = (self.tokens.launchpad_for(p.base_address) or "unknown")
                short_mint = p.base_address[:4] + "…"
                sym_display = p.base_symbol if p.base_symbol.startswith("$") else f"${p.base_symbol}"
                # Thought text is deliberately launchpad-agnostic — the
                # source is carried in the `extra` dict so the UI can render
                # it as a subtle badge if it wants, but we don't shout
                # brand names in the thought stream.
                self._push_event(
                    "explore",
                    f"scanning fresh launch {sym_display} "
                    f"({age_min:.0f}m old, ${mcap:,.0f} mcap, {short_mint}) → "
                    f"initial read: {action_name.upper()} ({conf * 100:.0f}%)",
                    f"扫描新盘 {sym_display}"
                    f"（{age_min:.0f} 分钟前发射，市值 ${mcap:,.0f}，{short_mint}）"
                    f" → 初判：{action_name_zh}（{conf * 100:.0f}%）",
                    extra={
                        "symbol": p.base_symbol, "mint": p.base_address,
                        "age_minutes": round(age_min, 1),
                        "mcap_usd": round(mcap, 2),
                        "action": action_name, "confidence": round(conf, 3),
                        "launchpad": pad,
                    },
                )
                # ---- Continuous knowledge learning ----
                # Add the token itself to the knowledge bank so the brain
                # can associate to it forever after. This is where the
                # knowledge library grows on its own.
                self._learn_token_concept(p, meta, pad)
            # Track the strongest non-HOLD intent this cycle for the hero card.
            candidate_intent = {
                "symbol": p.base_symbol,
                "mint": p.base_address,
                "price_usd": p.price_usd,
                "price_change_h1": p.price_change_h1,
                "price_change_h24": p.price_change_h24,
                "action": action,
                "action_name": action_name,
                "confidence": round(conf, 3),
                "probs": probs_list,
                "value_estimate": round(float(value.item()), 3),
                "at_s": time.time(),
            }
            if (best_intent is None
                    or (candidate_intent["action"] != HOLD and best_intent["action"] == HOLD)
                    or (candidate_intent["action"] == best_intent["action"]
                        and candidate_intent["confidence"] > best_intent["confidence"])):
                best_intent = candidate_intent

            held = p.base_address in self.paper.positions
            # Confidence gate: don't act unless the cortex is clearly leaning
            # that way. Prevents random-scalping-into-the-ground while
            # untrained. Fresh pump.fun launches get a stricter gate — the
            # noise floor on brand-new tokens is much higher and rug risk
            # is real, so we demand more conviction before opening.
            buy_gate = 0.65 if is_fresh else 0.50
            if action == BUY and not held and conf >= buy_gate:
                pos = self.paper.try_buy(
                    p.base_address, p.base_symbol, p.price_usd,
                    features=feats.tolist(), hints=hints.tolist(),
                )
                if pos:
                    self._push_event(
                        "trade",
                        f"BUY {p.base_symbol} @ ${p.price_usd:.6f} · "
                        f"conf {conf:.2f}",
                        f"买入 {p.base_symbol} @ ${p.price_usd:.6f} · "
                        f"置信度 {conf:.2f}",
                        extra={"symbol": p.base_symbol, "mint": p.base_address,
                               "side": "buy", "price_usd": p.price_usd},
                    )
                    # Mirror to real chain when the matching live executor
                    # is present.  Each chain has its own executor with
                    # its own hard confidence gate (`min_confidence`,
                    # default 0.75) — stricter than the paper gate on
                    # purpose.
                    if p.chain == "solana" and self.live is not None:
                        asyncio.create_task(self._live_buy(
                            p.base_address, p.base_symbol,
                            p.liquidity_usd or 0.0, conf,
                        ))
                    elif p.chain == "robinhood" and self.hood is not None:
                        asyncio.create_task(self._hood_buy(
                            p.base_address, p.base_symbol,
                            p.liquidity_usd or 0.0, conf,
                        ))
            elif action == SELL and held and conf >= 0.50:
                closed = self.paper.try_sell(p.base_address, p.price_usd, reason="policy_sell")
                if closed:
                    self._on_position_closed(closed)
                    if (p.chain == "solana" and self.live is not None
                            and p.base_address in self.live.open_positions):
                        asyncio.create_task(self._live_sell(
                            p.base_address, p.base_symbol,
                            p.liquidity_usd or 0.0,
                        ))
                    elif (p.chain == "robinhood" and self.hood is not None
                            and p.base_address.lower() in self.hood.open_positions):
                        asyncio.create_task(self._hood_sell(
                            p.base_address, p.base_symbol,
                            p.liquidity_usd or 0.0,
                        ))

        if best_intent is not None:
            self._latest_intent = best_intent

        # Cap the explored-fresh set so it doesn't grow unbounded.
        if len(self._explored_fresh_mints) > 4000:
            self._explored_fresh_mints = set(list(self._explored_fresh_mints)[-2000:])

        # 6) Persist state to disk regularly so a pod restart never
        # wipes more than ~60s of learning. Fly typically gives us 5s
        # between SIGINT and SIGKILL on a rolling deploy, and the
        # lifespan finally clause always calls _save_now() before we
        # exit — so 60s here is a floor, not a ceiling, on data-loss risk.
        if time.time() - self._last_save > 60:
            self._save_now()

    # ------------------------------------------------------------------

    async def _imitate_wallet_trades(self, trades) -> None:
        """Observe smart-money trades and decide, per trade, whether to learn.

        The brain is not blindly cloned onto every wallet action. For each
        observed expert trade we:

          1. Ask the brain what IT would do given the same market features.
          2. Compare its answer to the wallet's action:
             * If the brain already agreed on its own with strong confidence,
               skip BC entirely — it doesn't need more of a lesson it has
               already learned. Log an "independent_agree" thought.
             * If the brain disagreed with strong confidence, RESPECT that
               opinion — do not overwrite it with cross-entropy. Log a
               "conviction" thought; realized PnL later will judge who was
               right.
             * Otherwise the brain is uncertain — learn from the wallet as
               before, but with an annealing factor that fades BC influence
               as the brain matures.
        """
        if not trades:
            return
        already = getattr(self, "_imitated_sigs", set())
        hot_by_mint = {p.base_address: p for p in self.tokens.snapshot()}

        tc = self.brain.trader_cortex
        conf_gate = float(tc.own_opinion_threshold)

        for t in trades:
            if t.signature in already:
                continue
            already.add(t.signature)
            pair = hot_by_mint.get(t.token_mint)
            if not pair or pair.price_usd <= 0:
                continue

            feats = market_features_from_pair(pair)
            hints = torch.tensor(
                self.paper.hint_vector_for(t.token_mint, pair.price_usd),
                dtype=torch.float32,
            )
            expert_action = BUY if t.side == "buy" else SELL

            # ---- Ask the brain FIRST (no gradient, no side-effects) ----
            brain_action, _lp, brain_probs, _v = tc.decide(
                feats, hints, temperature=1.0,
            )
            brain_conf = float(brain_probs.max().item())
            agrees = (brain_action == expert_action)

            wallet_short = t.wallet[:4]
            side_zh = "买入" if t.side == "buy" else "卖出"
            brain_action_name = TRADER_ACTION_NAMES[brain_action]
            brain_action_name_zh = TRADER_ACTION_NAMES_ZH[brain_action]

            # Case A: brain independently agrees with strong conviction →
            # already learned that lesson, skip the BC step.
            if agrees and brain_conf >= conf_gate:
                tc.independent_agrees += 1
                self._push_event(
                    "independent_agree",
                    f"independent call {t.side.upper()} of {pair.base_symbol} "
                    f"({brain_conf * 100:.0f}%) — matches wallet {wallet_short}…, no need to imitate",
                    f"独立判断{side_zh} {pair.base_symbol}"
                    f"（{brain_conf * 100:.0f}%）——与钱包 {wallet_short}… 撞车，无需模仿",
                    extra={"wallet": t.wallet, "symbol": pair.base_symbol,
                           "side": t.side, "brain_conf": brain_conf,
                           "mode": "independent_agree"},
                )
                continue

            # Case B: brain disagrees with strong conviction → respect it.
            if not agrees and brain_conf >= conf_gate:
                tc.convictions += 1
                self._push_event(
                    "conviction",
                    f"conviction: brain wants {brain_action_name.upper()} on {pair.base_symbol} "
                    f"({brain_conf * 100:.0f}%), wallet {wallet_short}… did {t.side.upper()} — sticking with own call",
                    f"坚持己见：大脑对 {pair.base_symbol} 主张{brain_action_name_zh}"
                    f"（{brain_conf * 100:.0f}%），钱包 {wallet_short}… 却{side_zh}——不跟",
                    extra={"wallet": t.wallet, "symbol": pair.base_symbol,
                           "wallet_side": t.side,
                           "brain_action": brain_action_name,
                           "brain_conf": brain_conf,
                           "mode": "conviction"},
                )
                continue

            # Case C: brain uncertain (< own_opinion_threshold) → learn from
            # the wallet. Weight is still tilted toward winners, then scaled
            # down by (i) how disagreeable the brain was and (ii) global BC
            # annealing so the brain naturally weans off imitation over time.
            base_weight = 1.0
            board = self.leaderboard.get(t.wallet)
            if board.realized_pnl_usd > 0:
                base_weight = min(2.5, 1.0 + board.realized_pnl_usd / 5000.0)
            bc_scale = max(0.1, 1.0 - tc.total_wallet_trades_seen / 3000.0)
            disagree_discount = 0.4 if not agrees else 1.0
            weight = base_weight * bc_scale * disagree_discount

            loss = tc.clone_from_expert(
                feats, hints, expert_action, weight=weight,
            )
            tc.imitated += 1
            self._push_event(
                "imitate",
                f"unsure ({brain_conf * 100:.0f}%) — learning {t.side.upper()} of "
                f"{pair.base_symbol} from wallet {wallet_short}… "
                f"(wt {weight:.2f}, bc_loss {loss:.3f})",
                f"不确定（{brain_conf * 100:.0f}%）——向钱包 {wallet_short}… 学习"
                f"{side_zh} {pair.base_symbol}（权重 {weight:.2f}，BC 损失 {loss:.3f}）",
                extra={"wallet": t.wallet, "symbol": pair.base_symbol,
                       "side": t.side, "weight": weight,
                       "brain_conf": brain_conf, "mode": "imitate"},
            )
        self._imitated_sigs = already
        if len(already) > 1500:
            self._imitated_sigs = set(list(already)[-1000:])

    # ------------------------------------------------------------------

    def _on_position_closed(self, closed) -> None:
        pnl_frac = closed.pnl_pct
        self._push_event(
            "close",
            f"[paper] SELL {closed.token_symbol} @ ${closed.exit_price_usd:.6f} · "
            f"PnL ${closed.pnl_usd:+.2f} ({pnl_frac * 100:+.2f}%) · {closed.reason}",
            f"[paper] 平仓 {closed.token_symbol} @ ${closed.exit_price_usd:.6f} · "
            f"盈亏 ${closed.pnl_usd:+.2f} ({pnl_frac * 100:+.2f}%) · {closed.reason}",
            extra={"symbol": closed.token_symbol, "pnl_usd": closed.pnl_usd,
                   "pnl_pct": pnl_frac, "reason": closed.reason},
        )
        if closed.features_at_entry:
            feats = torch.tensor(closed.features_at_entry, dtype=torch.float32)
            hints = torch.tensor(closed.hints_at_entry or [0.0] * 6, dtype=torch.float32)
            self.brain.trader_cortex.reinforce_from_pnl(feats, hints, closed.action_taken, pnl_frac)
        # Big-outcome trades become permanent knowledge — the brain learns
        # the concept "this token earned/lost me X%" so future associations
        # to a similar market context can retrieve that lesson.
        if abs(pnl_frac) >= 0.15:
            self._learn_outcome_concept(closed, pnl_frac)

    # ------------------------------------------------------------------
    # Continuous knowledge growth
    # ------------------------------------------------------------------

    def _learn_token_concept(self, pair, meta, launchpad: str) -> None:
        """Add a fresh-launch token to the brain's permanent knowledge bank.

        The brain has never seen this mint before — after learning it, any
        future market context that "smells like" this one will surface a
        cortex-generated association to it, exactly like the seed BTC /
        Einstein concepts do.
        """
        sym = (pair.base_symbol or "?").strip() or "?"
        sym_display = sym if sym.startswith("$") else f"${sym}"
        age_min = meta.age_minutes if meta else 0.0
        mcap = meta.usd_market_cap if meta else (pair.market_cap or 0.0)
        cid = f"tok::{pair.base_address}"
        added = self.brain.learn_concept(
            concept_id=cid,
            category="learned_token",
            zh=f"{sym_display} · 新盘",
            en=f"{sym_display} · fresh launch",
            desc_zh=f"发射时首次遇到；{age_min:.0f} 分钟前上线，"
                    f"市值 ${mcap:,.0f}。"
                    f"合约 {pair.base_address[:4]}…{pair.base_address[-4:]}",
            desc_en=f"First seen at launch; {age_min:.0f} min old, "
                    f"${mcap:,.0f} mcap. "
                    f"mint {pair.base_address[:4]}…{pair.base_address[-4:]}",
            quiet=True,
        )
        if added:
            # Also learn the launchpad itself as a pattern the first time
            # we see it (once per launchpad, forever).
            self._maybe_learn_launchpad(launchpad)

    def _maybe_learn_launchpad(self, launchpad: str) -> None:
        if not launchpad or launchpad in ("unknown", "dexscreener"):
            return
        cid = f"pad::{launchpad}"
        # Stored in the knowledge bank silently — the user can browse
        # learned launchpads in the Knowledge tab if they want. We don't
        # push a "learn" thought or event so brand names don't leak into
        # the homepage thought stream.
        self.brain.learn_concept(
            concept_id=cid,
            category="learned_pattern",
            zh=f"发射台 · {launchpad}",
            en=f"Launchpad · {launchpad}",
            desc_zh=f"一个 Solana 发射台。大脑在这里第一次发现新代币。",
            desc_en=f"A Solana launchpad — the brain has begun watching it "
                    f"for fresh mints.",
            quiet=True,
        )

    def _learn_outcome_concept(self, closed, pnl_frac: float) -> None:
        """Record a big win/loss as a market-pattern concept."""
        sym = closed.token_symbol or "?"
        cid = f"outcome::{sym}::{int(closed.entry_at_s)}"
        win = pnl_frac > 0
        pct = int(round(pnl_frac * 100))
        self.brain.learn_concept(
            concept_id=cid,
            category="learned_event",
            zh=f"{'盈利' if win else '亏损'} {pct:+d}% · {sym}",
            en=f"{'Win' if win else 'Loss'} {pct:+d}% · {sym}",
            desc_zh=f"在 {sym} 上{'赚' if win else '亏'}了 {pct:+d}%（"
                    f"退出原因 {closed.reason}）。大脑把它作为一个模式记住。",
            desc_en=f"{'Made' if win else 'Lost'} {pct:+d}% on {sym} "
                    f"(exit reason {closed.reason}). Kept as a pattern.",
            quiet=False,
        )

    # ------------------------------------------------------------------

    def _save_now(self) -> None:
        self._last_save = time.time()
        self.persistence.save(
            brain=self.brain,
            trader_cortex=self.brain.trader_cortex,
            paper_trader=self.paper,
        )

    # ------------------------------------------------------------------
    # User-callable helpers
    # ------------------------------------------------------------------

    def add_wallet(self, wallet: str, label: str = "") -> bool:
        wallet = (wallet or "").strip()
        if not wallet or len(wallet) < 32:
            return False
        added = self.wallets.track(wallet, label, source="user")
        if not added:
            return False
        # User-added wallets are exempt from cool-down; clear any prior ban.
        self._pruned_until.pop(wallet, None)
        self.leaderboard.set_label(wallet, label or "custom")
        self._push_event(
            "wallet_add",
            f"Now tracking wallet {wallet[:6]}… ({label or 'custom'})",
            f"开始跟踪钱包 {wallet[:6]}…（{label or '自定义'}）",
        )
        return True

    def remove_wallet(self, wallet: str) -> None:
        self.wallets.untrack(wallet)
        self._push_event(
            "wallet_remove",
            f"Stopped tracking wallet {wallet[:6]}…",
            f"停止跟踪钱包 {wallet[:6]}…",
        )

    # ------------------------------------------------------------------

    def snapshot(self) -> dict:
        pairs = self.tokens.snapshot()
        prices = {p.base_address: p.price_usd for p in pairs if p.price_usd > 0}
        for mint, pos in self.paper.positions.items():
            prices.setdefault(mint, pos.entry_price_usd)
        return {
            "mode": "live" if (self.live is not None or self.hood is not None) else "paper",
            "tokens_status": self.tokens.status(),
            "wallets_status": self.wallets.status(),
            "discovery_status": self.discovery.status(),
            "hot_tokens": self.tokens.snapshot_public(),
            "fresh_launches": self.tokens.fresh_launches_public(),
            "tracked_wallets": self.wallets.wallets_public(),
            "recent_wallet_trades": self.wallets.recent_trades_public(limit=30),
            "leaderboard": self.leaderboard.top_public(15),
            "paper": self.paper.snapshot(prices),
            "live": self.live.snapshot() if self.live is not None else None,
            "hood": self.hood.snapshot() if self.hood is not None else None,
            "trader_cortex_stats": self.brain.trader_cortex.stats(),
            "latest_intent": self._latest_intent,
            "events": list(self._trader_events[-60:]),
            "tuning": {
                "decision_interval": self.decision_interval,
                "discovery_interval": self.discovery_interval,
                "target_tracked_wallets": self.target_tracked_wallets,
                "take_profit_pct": self.take_profit_pct,
                "stop_loss_pct": self.stop_loss_pct,
                "max_hold_hours": self.max_hold_hours,
            },
        }
