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

        # Seed wallets (default + env-configured) — always source=env
        for addr, label in DEFAULT_SEED_WALLETS + _parse_env_wallets():
            self.wallets.track(addr, label, source="env")
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

        # 5) Ask the Trader Cortex for a decision on each hot token
        # Only consider fresh-ish + liquid + big-move tokens to save compute
        candidates = [
            p for p in hot
            if p.liquidity_usd >= 20_000
            and abs(p.price_change_h1) >= 1.0
        ]
        best_intent: Optional[dict] = None
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
            probs_list = [round(float(x), 3) for x in probs.tolist()]
            action_name = TRADER_ACTION_NAMES[action]
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

        if best_intent is not None:
            self._latest_intent = best_intent

        # 6) Persist state every few minutes
        if time.time() - self._last_save > 180:
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
            "mode": "paper",
            "tokens_status": self.tokens.status(),
            "wallets_status": self.wallets.status(),
            "discovery_status": self.discovery.status(),
            "hot_tokens": self.tokens.snapshot_public(),
            "tracked_wallets": self.wallets.wallets_public(),
            "recent_wallet_trades": self.wallets.recent_trades_public(limit=30),
            "leaderboard": self.leaderboard.top_public(15),
            "paper": self.paper.snapshot(prices),
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
