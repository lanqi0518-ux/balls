"""Turn a DexScreener pair snapshot into a fixed-size feature vector.

The vector goes into the Trader Cortex as its "what does this token look
like right now?" input. Everything is log/tanh-squashed so it stays in a
reasonable range for a small MLP.
"""

from __future__ import annotations

import math
from typing import Optional

import torch

from .dexscreener import PairSnapshot


MARKET_FEATURE_DIM = 16


def _lognorm(x: float, k: float = 1e5) -> float:
    """log10(1 + x) / log10(1 + k) — squashes 0..k to roughly 0..1."""
    if x is None:
        return 0.0
    x = max(0.0, float(x))
    denom = math.log10(1.0 + k)
    return math.log10(1.0 + x) / denom if denom else 0.0


def _pct(x: float, scale: float = 25.0) -> float:
    """tanh-squash a % change (typical -25..+25%)."""
    if x is None:
        return 0.0
    return math.tanh(float(x) / scale)


def _ratio(a: float, b: float) -> float:
    a = float(a or 0.0)
    b = float(b or 0.0)
    tot = a + b
    if tot <= 0:
        return 0.0
    return math.tanh((a - b) / tot * 2)  # -1..1


def market_features_from_pair(p: PairSnapshot) -> torch.Tensor:
    v = [
        _lognorm(p.liquidity_usd, 1e7),
        _lognorm(p.volume_h24, 5e6),
        _lognorm(p.volume_h1, 5e5),
        _lognorm(p.volume_m5, 5e4),
        _pct(p.price_change_m5, 8.0),
        _pct(p.price_change_h1, 20.0),
        _pct(p.price_change_h24, 60.0),
        _ratio(p.txns_h1_buys, p.txns_h1_sells),
        _ratio(p.txns_m5_buys, p.txns_m5_sells),
        _lognorm(p.txns_h1_buys + p.txns_h1_sells, 2000.0),
        _lognorm(p.fdv, 1e8),
        _lognorm(p.market_cap, 1e8),
        math.tanh(p.age_hours / 24.0),
        # room for two currently-unused slots to keep dim stable across changes
        0.0, 0.0, 0.0,
    ]
    assert len(v) == MARKET_FEATURE_DIM, f"expected {MARKET_FEATURE_DIM}, got {len(v)}"
    return torch.tensor(v, dtype=torch.float32)


def empty_market_features() -> torch.Tensor:
    return torch.zeros(MARKET_FEATURE_DIM, dtype=torch.float32)
