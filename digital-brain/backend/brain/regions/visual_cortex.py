"""Occipital visual cortex.

Takes the raw 3-channel grid the agent 'sees' and extracts a compact feature
vector via a small CNN. Downstream regions consume this vector as the
current visual scene representation.

Activation is derived from mean absolute response — a busier scene lights
this region up more.
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from ..region import BrainRegion, RegionMeta, _count_active


class VisualCortex(BrainRegion):
    meta = RegionMeta(
        name="visual_cortex",
        display_name="Visual cortex (V1–V4)",
        zh_name="视觉皮层",
        position=(0.0, -80.0, 15.0),
        color="#8b5cf6",
        role="Processes raw visual input into features",
        role_zh="把看到的东西转成特征",
    )

    def __init__(self, feature_dim: int = 32):
        super().__init__()
        self.feature_dim = feature_dim
        self.net = nn.Sequential(
            nn.Conv2d(3, 16, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv2d(16, 16, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d(4),
            nn.Flatten(),
            nn.Linear(16 * 4 * 4, feature_dim),
            nn.Tanh(),
        )
        self.neurons_total = feature_dim + 16 * 4 * 4

    def forward(self, image: torch.Tensor) -> torch.Tensor:
        """image: (3, H, W) float tensor in [0, 1]."""
        with torch.no_grad():
            features = self.net(image.unsqueeze(0)).squeeze(0)
        act = float(features.abs().mean().item())
        self._set_activity(min(1.0, act * 2.5), _count_active(features))
        return features
