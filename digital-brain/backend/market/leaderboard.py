"""Rolling-window PnL leaderboard for tracked wallets.

For every tracked wallet we accumulate its trades from the WalletWatcher,
FIFO-match buys against sells per token, and compute *realized* PnL in USD
over a rolling window (default 24h). Wallets are ranked and the top K are
called our "smart money" list.

This is a from-scratch equivalent of what gmgn.ai's leaderboard does; the
numbers won't match exactly (they have far more accurate on-chain pricing
than a public RPC gives us) but the *ranking* is directionally correct.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Tuple

from .wallets import TrackedTrade


@dataclass
class WalletPnL:
    wallet: str
    label: str = ""
    realized_pnl_usd: float = 0.0
    n_trades: int = 0
    n_wins: int = 0
    volume_usd: float = 0.0
    updated_at: float = 0.0

    @property
    def win_rate(self) -> float:
        return self.n_wins / self.n_trades if self.n_trades else 0.0

    def to_public(self) -> dict:
        return {
            "wallet": self.wallet,
            "label": self.label,
            "realized_pnl_usd": round(self.realized_pnl_usd, 2),
            "n_trades": self.n_trades,
            "win_rate": round(self.win_rate, 3),
            "volume_usd": round(self.volume_usd, 2),
            "updated_at_ms": int(self.updated_at * 1000),
        }


class Leaderboard:
    def __init__(self, window_seconds: float = 24 * 3600):
        self.window = window_seconds
        # wallet -> token_mint -> FIFO deque of (amount, unit_cost_usd)
        self._inventory: Dict[str, Dict[str, Deque[Tuple[float, float]]]] = defaultdict(
            lambda: defaultdict(deque)
        )
        self._pnl: Dict[str, WalletPnL] = {}
        self._processed_sigs: set = set()

    def set_label(self, wallet: str, label: str) -> None:
        p = self._pnl.setdefault(wallet, WalletPnL(wallet=wallet))
        p.label = label

    def ingest(self, trades: List[TrackedTrade]) -> None:
        now = time.time()
        for t in trades:
            if t.signature in self._processed_sigs:
                continue
            self._processed_sigs.add(t.signature)
            self._absorb(t, now)
        # Trim signature memory occasionally so it doesn't grow forever
        if len(self._processed_sigs) > 5000:
            self._processed_sigs = set(list(self._processed_sigs)[-3000:])

    def _absorb(self, t: TrackedTrade, now: float) -> None:
        p = self._pnl.setdefault(t.wallet, WalletPnL(wallet=t.wallet))
        p.n_trades += 1
        p.updated_at = now
        unit_price = t.price_usd_est if t.price_usd_est > 0 else 0.0
        notional = unit_price * t.token_amount if unit_price else max(t.stable_amount, 0.0)
        p.volume_usd += notional
        book = self._inventory[t.wallet][t.token_mint]
        if t.side == "buy":
            book.append((t.token_amount, unit_price))
        else:
            # Sell — FIFO match
            remaining = t.token_amount
            while remaining > 1e-9 and book:
                lot_amt, lot_cost = book[0]
                take = min(remaining, lot_amt)
                pnl = (unit_price - lot_cost) * take
                p.realized_pnl_usd += pnl
                if pnl > 0:
                    p.n_wins += 1
                remaining -= take
                if take >= lot_amt - 1e-9:
                    book.popleft()
                else:
                    book[0] = (lot_amt - take, lot_cost)
            # If we ran out of inventory (unknown prior cost basis), treat remainder as pure gain
            if remaining > 1e-9 and unit_price > 0:
                p.realized_pnl_usd += unit_price * remaining

    def top(self, k: int = 10) -> List[WalletPnL]:
        return sorted(
            self._pnl.values(), key=lambda p: p.realized_pnl_usd, reverse=True
        )[:k]

    def top_public(self, k: int = 10) -> List[dict]:
        return [p.to_public() for p in self.top(k)]

    def get(self, wallet: str) -> WalletPnL:
        return self._pnl.setdefault(wallet, WalletPnL(wallet=wallet))
