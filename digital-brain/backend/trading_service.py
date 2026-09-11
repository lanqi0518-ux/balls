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
    market_features_from_pair,
)
from .paper_trader import PaperTrader
from .persistence import Persistence


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
                 persistence_dir: Optional[str] = None):
        self.brain = brain
        self.dexscreener = DexScreenerClient()
        self.tokens = TrendingTokenWatcher(
            client=self.dexscreener,
            refresh_interval=trending_interval,
        )
        self.wallets = WalletWatcher(poll_interval=wallet_poll_interval)
        self.leaderboard = Leaderboard()
        self.paper = PaperTrader(start_usd=start_usd)
        self.persistence = Persistence(persistence_dir or os.getenv("DATA_DIR", "./data"))

        self.decision_interval = decision_interval
        self.take_profit_pct = 0.35     # +35% take profit
        self.stop_loss_pct = -0.18      # -18% stop loss
        self.max_hold_hours = 12.0
        self._trader_events: List[dict] = []
        self._max_events = 80
        self._tasks: List[asyncio.Task] = []
        self._stop = asyncio.Event()
        self._last_save = 0.0

        # Seed wallets (default + env-configured)
        for addr, label in DEFAULT_SEED_WALLETS + _parse_env_wallets():
            self.wallets.track(addr, label)
            self.leaderboard.set_label(addr, label)

        # Restore any prior state
        restored = self.persistence.load_into(
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

    async def start(self) -> None:
        if self._tasks:
            return
        self._stop.clear()
        await self.tokens.start()
        await self.wallets.start()
        self._tasks = [
            asyncio.create_task(self._decision_loop(), name="td-decisions"),
            asyncio.create_task(self._sol_price_loop(), name="td-solprice"),
        ]

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
        self._save_now()

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

        # 5) Ask the Trader Cortex for a decision on each hot token
        # Only consider fresh-ish + liquid + big-move tokens to save compute
        candidates = [
            p for p in hot
            if p.liquidity_usd >= 20_000
            and abs(p.price_change_h1) >= 1.0
        ]
        for p in candidates[:12]:
            if p.price_usd <= 0:
                continue
            feats = market_features_from_pair(p)
            hints = torch.tensor(
                self.paper.hint_vector_for(p.base_address, p.price_usd),
                dtype=torch.float32,
            )
            action, log_prob, probs, value = self.brain.trader_cortex.decide(
                feats, hints, temperature=1.0,
            )
            conf = self.brain.trader_cortex.last_confidence
            held = p.base_address in self.paper.positions
            # Confidence gate: don't act unless the cortex is clearly leaning
            # that way. Prevents random-scalping-into-the-ground while untrained.
            if action == BUY and not held and conf >= 0.50:
                pos = self.paper.try_buy(
                    p.base_address, p.base_symbol, p.price_usd,
                    features=feats.tolist(), hints=hints.tolist(),
                )
                if pos:
                    self._push_event(
                        "trade",
                        f"[paper] BUY {p.base_symbol} @ ${p.price_usd:.6f} · "
                        f"conf {conf:.2f}",
                        f"[paper] 买入 {p.base_symbol} @ ${p.price_usd:.6f} · "
                        f"置信度 {conf:.2f}",
                        extra={"symbol": p.base_symbol, "mint": p.base_address,
                               "side": "buy", "price_usd": p.price_usd},
                    )
            elif action == SELL and held and conf >= 0.50:
                closed = self.paper.try_sell(p.base_address, p.price_usd, reason="policy_sell")
                if closed:
                    self._on_position_closed(closed)

        # 6) Persist state every few minutes
        if time.time() - self._last_save > 180:
            self._save_now()

    # ------------------------------------------------------------------

    async def _imitate_wallet_trades(self, trades) -> None:
        if not trades:
            return
        # Only process trades we haven't imitated yet (dedupe by signature).
        already = getattr(self, "_imitated_sigs", set())
        hot_by_mint = {p.base_address: p for p in self.tokens.snapshot()}
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
            weight = 1.0
            # Weight the update by the wallet's realized PnL — more from winners.
            board = self.leaderboard.get(t.wallet)
            if board.realized_pnl_usd > 0:
                weight = min(2.5, 1.0 + board.realized_pnl_usd / 5000.0)
            loss = self.brain.trader_cortex.clone_from_expert(
                feats, hints, expert_action, weight=weight,
            )
            self._push_event(
                "imitate",
                f"copy {t.side.upper()} of {pair.base_symbol} from wallet {t.wallet[:4]}… "
                f"(wt {weight:.2f}, bc_loss {loss:.3f})",
                f"跟随钱包 {t.wallet[:4]}… 的{('买入' if t.side=='buy' else '卖出')} {pair.base_symbol}"
                f"（权重 {weight:.2f}，BC 损失 {loss:.3f}）",
                extra={"wallet": t.wallet, "symbol": pair.base_symbol,
                       "side": t.side, "weight": weight},
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

    # ------------------------------------------------------------------

    def _save_now(self) -> None:
        self._last_save = time.time()
        self.persistence.save(
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
        self.wallets.track(wallet, label)
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
            "mode": "paper",
            "tokens_status": self.tokens.status(),
            "wallets_status": self.wallets.status(),
            "hot_tokens": self.tokens.snapshot_public(),
            "tracked_wallets": self.wallets.wallets_public(),
            "recent_wallet_trades": self.wallets.recent_trades_public(limit=30),
            "leaderboard": self.leaderboard.top_public(15),
            "paper": self.paper.snapshot(prices),
            "trader_cortex_stats": self.brain.trader_cortex.stats(),
            "events": list(self._trader_events[-60:]),
            "tuning": {
                "decision_interval": self.decision_interval,
                "take_profit_pct": self.take_profit_pct,
                "stop_loss_pct": self.stop_loss_pct,
                "max_hold_hours": self.max_hold_hours,
            },
        }
