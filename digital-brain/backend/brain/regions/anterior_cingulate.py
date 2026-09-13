"""Anterior cingulate cortex (ACC) — conflict monitoring.

Biologically, the ACC lights up whenever there is conflict between
candidate motor plans, when an error is detected, or when the current
policy is producing worse-than-expected outcomes. Its output is the
canonical "you need to pay more attention" signal — dACC firing recruits
the lateral PFC to increase cognitive control.

Reference:
  Botvinick, M. M., Braver, T. S., Barch, D. M., Carter, C. S. & Cohen,
  J. D. (2001) "Conflict monitoring and cognitive control", Psych. Rev.
  Carter, C. S. et al. (1998) "Anterior cingulate cortex, error
  detection, and the online monitoring of performance", Science.
  Shenhav, A., Botvinick, M. M. & Cohen, J. D. (2013) "The expected value
  of control", Neuron.

Implementation: each tick we compute the entropy of the PFC action
distribution and the magnitude of the recent reward-prediction error.
When both are high — the brain is torn AND making bad predictions —
`conflict` spikes toward 1 and downstream regions (LC gain, engagement)
are amplified.
"""

from __future__ import annotations

import math
from collections import deque
from typing import Deque, List

import torch

from ..region import BrainRegion, RegionMeta


class AnteriorCingulate(BrainRegion):
    meta = RegionMeta(
        name="anterior_cingulate",
        display_name="Anterior cingulate",
        zh_name="前扣带皮层",
        # Medial, dorsal, front — sits above the corpus callosum.
        position=(0.0, 42.0, 42.0),
        color="#eab308",
        role="Conflict monitoring · error detection",
        role_zh="冲突监控 · 错误检测",
    )

    def __init__(self, window: int = 40):
        super().__init__()
        self.neurons_total = 88
        self.window = window
        self.errors: Deque[float] = deque(maxlen=window)
        self.conflict: float = 0.0
        self.last_entropy: float = 0.0

    @staticmethod
    def _entropy(probs: torch.Tensor) -> float:
        p = probs.detach().clamp(min=1e-8)
        return float(-(p * p.log()).sum().item())

    def observe(self, action_probs: torch.Tensor,
                 pred_error: float) -> float:
        """Called after motor.act() with the sampled action distribution
        and NAcc's prediction error."""
        h = self._entropy(action_probs)
        # Normalize entropy by log(N) so it sits in [0, 1].
        h_norm = h / max(1e-6, math.log(max(2, action_probs.numel())))
        self.last_entropy = h_norm
        self.errors.append(abs(float(pred_error)))
        mean_err = sum(self.errors) / len(self.errors) if self.errors else 0.0
        # Conflict = entropy × recent surprise. Both must be non-trivial.
        raw = h_norm * min(1.0, mean_err * 1.4)
        # Soft floor so a completely certain, well-calibrated brain still
        # shows a faint ACC baseline.
        self.conflict = float(max(0.05, min(1.0, raw)))
        self._set_activity(self.conflict,
                            int(self.conflict * self.neurons_total))
        if self.conflict > 0.7:
            self.note(f"high conflict (H={h_norm:.2f}, err={mean_err:.2f})")
        return self.conflict

    def control_boost(self) -> float:
        """Additive boost applied to engagement — how hard PFC should
        recruit itself in the next tick."""
        return 0.25 * self.conflict

    def stats(self) -> dict:
        return {
            "conflict": round(self.conflict, 3),
            "entropy": round(self.last_entropy, 3),
            "err_samples": len(self.errors),
        }

    def state_dict_serializable(self) -> dict:
        return {
            "errors": list(self.errors),
            "conflict": self.conflict,
            "last_entropy": self.last_entropy,
        }

    def load_state_dict_safe(self, sd: dict) -> None:
        try:
            self.errors = deque(sd.get("errors", []) or [], maxlen=self.window)
            self.conflict = float(sd.get("conflict", 0.0))
            self.last_entropy = float(sd.get("last_entropy", 0.0))
        except Exception:  # noqa: BLE001
            pass
