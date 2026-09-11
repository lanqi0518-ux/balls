"""Amygdala — fast-onset, slow-decay threat/fear signal.

Biologically, the amygdala receives a 'quick and dirty' subcortical route
(via the thalamus) and also integrates cortical input. It sends a fear
signal to the prefrontal cortex that biases decisions away from perceived
threats, and it tags memories in the hippocampus with emotional valence
(fear-tagged memories are much stronger).

Implementation: a leaky integrator with associative fear conditioning. If
the agent encounters an aversive outcome shortly after a visual pattern, the
amygdala learns to fire on that pattern too (Pavlovian-style).
"""

from __future__ import annotations

from collections import deque
from typing import Deque, Tuple

import torch
import torch.nn.functional as F

from ..region import BrainRegion, RegionMeta


class Amygdala(BrainRegion):
    meta = RegionMeta(
        name="amygdala",
        display_name="Amygdala",
        zh_name="杏仁核",
        position=(-18.0, -8.0, -22.0),
        color="#ef4444",
        role="Detects threat, generates fear, tags emotional memory",
        role_zh="检测威胁，产生恐惧，标记情绪记忆",
    )

    def __init__(self, feature_dim: int = 32, decay: float = 0.75):
        super().__init__()
        self.fear: float = 0.0
        self.decay = decay
        self.neurons_total = 64
        # Simple associative memory: learned fear-inducing feature templates.
        self.conditioned: list[torch.Tensor] = []
        self._recent: Deque[Tuple[torch.Tensor, int]] = deque(maxlen=4)

    def _conditioned_response(self, features: torch.Tensor) -> float:
        if not self.conditioned:
            return 0.0
        stacked = torch.stack(self.conditioned)
        sims = F.cosine_similarity(features.unsqueeze(0), stacked, dim=-1)
        m = float(sims.max().item()) if sims.numel() > 0 else 0.0
        # Only "high" similarities count — otherwise everything looks scary.
        return max(0.0, m - 0.5) * 2.0

    def perceive(self, features: torch.Tensor, danger_signal: float,
                 step: int) -> float:
        """Update fear based on raw danger signal + learned associations."""
        cond = self._conditioned_response(features)
        driving = max(danger_signal, cond * 0.6)
        # Leaky integrator; no extra boost, so fear tracks the driving signal.
        self.fear = self.fear * self.decay + driving * (1 - self.decay)
        self.fear = max(0.0, min(1.0, self.fear))
        self._set_activity(self.fear, int(self.fear * self.neurons_total))
        self._recent.append((features.detach().clone(), step))
        if self.fear > 0.6:
            self.note(f"⚠ threat detected (fear={self.fear:.2f})")
        return self.fear

    def condition(self, punishment: float) -> None:
        """Called after the agent gets hurt: retroactively tag recent
        visual features as fear-inducing.
        """
        if punishment >= 0 or not self._recent:
            return
        latest, _ = self._recent[-1]
        self.conditioned.append(latest)
        if len(self.conditioned) > 12:
            self.conditioned.pop(0)
        self.fear = min(1.0, self.fear + 0.25)
        self.note(f"conditioned new fear ({len(self.conditioned)} templates)")

    def stats(self) -> dict:
        return {
            "fear": round(self.fear, 3),
            "conditioned_templates": len(self.conditioned),
        }
