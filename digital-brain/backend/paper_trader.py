"""Paper trader — simulated broker for the Digital Brain.

Given real DexScreener prices, we keep a fake $X USD portfolio, execute
buy/sell decisions coming from the Trader Cortex, and track PnL.

Trades are fully simulated (no on-chain calls, no private keys). This is
Phase 3 of the trading roadmap. Phase 4 (real orders) would swap this
class out for a Jupiter-swap-based executor.

Assumptions / simplifications:
    * Prices are DexScreener USD prices, sampled once per tick.
    * Slippage is modeled as a flat 0.5% each way plus a 1% fee.
    * Positions are single-token, no fractional lots, one open per token.
    * Sizes are capped by ``max_size_frac`` of portfolio USD.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional


DEFAULT_START_USD = 10_000.0
DEFAULT_TX_COST = 0.015          # 1.5% round-trip friction (slippage + fees)
DEFAULT_MAX_POS_FRAC = 0.10      # max 10% of book on any single trade
DEFAULT_MAX_POSITIONS = 6


@dataclass
class Position:
    token_mint: str
    token_symbol: str
    entry_price_usd: float
    entry_at_s: float
    qty_tokens: float           # for accounting; we treat qty in USD-equivalent internally
    usd_size: float             # dollars committed at entry (after fees)
    features_at_entry: List[float] = field(default_factory=list)
    hints_at_entry: List[float] = field(default_factory=list)

    def to_public(self, current_price: float) -> dict:
        pnl_usd = self.qty_tokens * current_price - self.usd_size
        pnl_pct = pnl_usd / self.usd_size if self.usd_size else 0.0
        return {
            "token_mint": self.token_mint,
            "token_symbol": self.token_symbol,
            "entry_price_usd": self.entry_price_usd,
            "current_price_usd": current_price,
            "qty_tokens": self.qty_tokens,
            "usd_size": self.usd_size,
            "pnl_usd": round(pnl_usd, 2),
            "pnl_pct": round(pnl_pct * 100, 2),
            "hold_seconds": int(time.time() - self.entry_at_s),
        }


@dataclass
class ClosedTrade:
    token_mint: str
    token_symbol: str
    side: str                 # "long" for now
    opened_at_s: float
    closed_at_s: float
    entry_price_usd: float
    exit_price_usd: float
    usd_size: float
    pnl_usd: float
    pnl_pct: float
    reason: str
    features_at_entry: List[float] = field(default_factory=list)
    hints_at_entry: List[float] = field(default_factory=list)
    action_taken: int = 1  # BUY

    def to_public(self) -> dict:
        d = asdict(self)
        d.pop("features_at_entry", None)
        d.pop("hints_at_entry", None)
        return d


class PaperTrader:
    def __init__(self, start_usd: float = DEFAULT_START_USD,
                 max_positions: int = DEFAULT_MAX_POSITIONS,
                 max_pos_frac: float = DEFAULT_MAX_POS_FRAC,
                 tx_cost: float = DEFAULT_TX_COST):
        self.start_usd = start_usd
        self.cash_usd = start_usd
        self.tx_cost = tx_cost
        self.max_positions = max_positions
        self.max_pos_frac = max_pos_frac
        self.positions: Dict[str, Position] = {}    # keyed by token_mint
        self.closed: List[ClosedTrade] = []
        self._equity_curve: List[dict] = []          # rolling; capped
        self._max_curve = 400

    # ------------------------------------------------------------------

    def hint_vector_for(self, token_mint: str, price_usd: float) -> List[float]:
        """A small vector the cortex uses in addition to market features."""
        equity = self.equity_usd({token_mint: price_usd} if token_mint else {})
        cash_frac = self.cash_usd / max(equity, 1e-3)
        pos = self.positions.get(token_mint)
        pos_frac = 0.0
        unreal_pnl_pct = 0.0
        hold_hours = 0.0
        if pos:
            live_val = pos.qty_tokens * price_usd
            pos_frac = live_val / max(equity, 1e-3)
            unreal_pnl_pct = (live_val - pos.usd_size) / max(pos.usd_size, 1e-3)
            hold_hours = (time.time() - pos.entry_at_s) / 3600.0
        n_pos = len(self.positions) / max(1, self.max_positions)
        return [
            cash_frac,
            pos_frac,
            max(-2.0, min(2.0, unreal_pnl_pct * 2)),
            min(1.5, hold_hours / 6.0),
            n_pos,
            1.0 if pos else 0.0,
        ]

    # ------------------------------------------------------------------

    def try_buy(self, token_mint: str, token_symbol: str, price_usd: float,
                 features: List[float], hints: List[float]) -> Optional[Position]:
        if price_usd <= 0:
            return None
        if token_mint in self.positions:
            return None
        if len(self.positions) >= self.max_positions:
            return None
        equity = self.equity_usd({m: p.entry_price_usd for m, p in self.positions.items()}
                                 | {token_mint: price_usd})
        size_usd = min(self.cash_usd * self.max_pos_frac, equity * self.max_pos_frac)
        if size_usd < 25.0:
            return None
        fee = size_usd * (self.tx_cost / 2)
        net = size_usd - fee
        qty = net / price_usd
        self.cash_usd -= size_usd
        pos = Position(
            token_mint=token_mint,
            token_symbol=token_symbol,
            entry_price_usd=price_usd,
            entry_at_s=time.time(),
            qty_tokens=qty,
            usd_size=net,
            features_at_entry=list(features),
            hints_at_entry=list(hints),
        )
        self.positions[token_mint] = pos
        return pos

    def try_sell(self, token_mint: str, price_usd: float, reason: str = "policy"
                 ) -> Optional[ClosedTrade]:
        pos = self.positions.get(token_mint)
        if not pos or price_usd <= 0:
            return None
        gross = pos.qty_tokens * price_usd
        fee = gross * (self.tx_cost / 2)
        net = gross - fee
        self.cash_usd += net
        pnl_usd = net - pos.usd_size
        pnl_pct = pnl_usd / pos.usd_size if pos.usd_size else 0.0
        closed = ClosedTrade(
            token_mint=token_mint,
            token_symbol=pos.token_symbol,
            side="long",
            opened_at_s=pos.entry_at_s,
            closed_at_s=time.time(),
            entry_price_usd=pos.entry_price_usd,
            exit_price_usd=price_usd,
            usd_size=pos.usd_size,
            pnl_usd=pnl_usd,
            pnl_pct=pnl_pct,
            reason=reason,
            features_at_entry=list(pos.features_at_entry),
            hints_at_entry=list(pos.hints_at_entry),
        )
        self.closed.append(closed)
        if len(self.closed) > 200:
            self.closed[:] = self.closed[-200:]
        self.positions.pop(token_mint, None)
        return closed

    # ------------------------------------------------------------------

    def equity_usd(self, prices: Dict[str, float]) -> float:
        eq = self.cash_usd
        for mint, pos in self.positions.items():
            price = prices.get(mint, pos.entry_price_usd)
            eq += pos.qty_tokens * price
        return eq

    def note_equity(self, prices: Dict[str, float]) -> None:
        eq = self.equity_usd(prices)
        self._equity_curve.append({"t": int(time.time()), "eq": round(eq, 2)})
        if len(self._equity_curve) > self._max_curve:
            self._equity_curve[:] = self._equity_curve[-self._max_curve:]

    # ------------------------------------------------------------------

    def snapshot(self, prices: Dict[str, float]) -> dict:
        equity = self.equity_usd(prices)
        realized = sum(t.pnl_usd for t in self.closed)
        n_win = sum(1 for t in self.closed if t.pnl_usd > 0)
        n_trade = len(self.closed)
        return {
            "start_usd": self.start_usd,
            "cash_usd": round(self.cash_usd, 2),
            "equity_usd": round(equity, 2),
            "unrealized_usd": round(equity - self.cash_usd - self.start_usd + sum(t.usd_size - (t.usd_size + t.pnl_usd) for t in []), 2),
            "realized_pnl_usd": round(realized, 2),
            "total_pnl_usd": round(equity - self.start_usd, 2),
            "total_pnl_pct": round((equity / self.start_usd - 1) * 100, 3),
            "n_positions": len(self.positions),
            "n_trades_closed": n_trade,
            "win_rate": round(n_win / n_trade, 3) if n_trade else 0.0,
            "positions": [
                p.to_public(prices.get(m, p.entry_price_usd))
                for m, p in self.positions.items()
            ],
            "closed_recent": [t.to_public() for t in self.closed[-15:]],
            "equity_curve": list(self._equity_curve[-120:]),
        }

    # ------------------------------------------------------------------

    def state_dict_serializable(self) -> dict:
        return {
            "start_usd": self.start_usd,
            "cash_usd": self.cash_usd,
            "positions": {m: asdict(p) for m, p in self.positions.items()},
            "closed": [asdict(t) for t in self.closed],
            "equity_curve": self._equity_curve,
        }

    def load_state(self, sd: dict) -> None:
        try:
            self.start_usd = float(sd.get("start_usd", self.start_usd))
            self.cash_usd = float(sd.get("cash_usd", self.cash_usd))
            self.positions = {
                m: Position(**{**pos, "features_at_entry": list(pos.get("features_at_entry", [])),
                               "hints_at_entry": list(pos.get("hints_at_entry", []))})
                for m, pos in sd.get("positions", {}).items()
            }
            self.closed = [ClosedTrade(**{**c, "features_at_entry": list(c.get("features_at_entry", [])),
                                          "hints_at_entry": list(c.get("hints_at_entry", []))})
                           for c in sd.get("closed", [])]
            self._equity_curve = list(sd.get("equity_curve", []))
        except Exception:
            pass
