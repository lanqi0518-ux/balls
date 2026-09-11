"""Thalamus — the sensory gating hub.

Anatomically the thalamus routes almost all sensory information to the
appropriate cortical area, gated by attentional signals from the PFC. Here
we implement it as a simple learnable gate that scales visual features
based on top-down attention (currently just the fear signal — high fear
sharpens the salient parts of the scene).
"""

from __future__ import annotations

import torch

from ..region import BrainRegion, RegionMeta


class Thalamus(BrainRegion):
    meta = RegionMeta(
        name="thalamus",
        display_name="Thalamus",
        zh_name="丘脑",
        position=(0.0, -5.0, 5.0),
        color="#e879f9",
        role="Sensory gating and top-down attention",
        role_zh="感官门控与自上而下的注意力",
    )

    def __init__(self, feature_dim: int = 32):
        super().__init__()
        self.feature_dim = feature_dim
        self.neurons_total = feature_dim
        self.last_gain: float = 1.0

    def gate(self, features: torch.Tensor, fear: float, engagement: float) -> torch.Tensor:
        # Higher fear or engagement sharpens the signal (multiplicative gain).
        gain = 1.0 + 0.6 * fear + 0.4 * engagement
        self.last_gain = gain
        gated = torch.tanh(features * gain)
        self._set_activity(min(1.0, gain / 2.0), int(gain * 20))
        return gated
