"""Locus coeruleus — noradrenergic global gain under uncertainty.

Biologically, the locus coeruleus is a tiny brainstem nucleus (~50k
neurons in humans) that produces most of the brain's noradrenaline.
Under uncertainty and novelty its tonic firing rate rises, releasing
NA globally and sharpening cortical gain — perception becomes sharper,
attention becomes narrower, and the brain shifts from exploitation
toward exploration.

    10|Reference:
  Aston-Jones, G. & Cohen, J. D. (2005) "An integrative theory of
  locus coeruleus-norepinephrine function: adaptive gain and optimal
  performance", Annu. Rev. Neurosci.
  Yu, A. J. & Dayan, P. (2005) "Uncertainty, neuromodulation, and
  attention", Neuron.

Implementation: LC tracks the running |prediction error| from the NAcc
and produces a scalar ``gain`` ∈ [1.0, 1.6]. Downstream, the thalamus
multiplies its post-gate output by this scalar — high LC gain means the
    20|whole cortex is running "hot", i.e. more attentive to novel input.
"""

from __future__ import annotations

from collections import deque
from typing import Deque

from ..region import BrainRegion, RegionMeta


class LocusCoeruleus(BrainRegion):
    meta = RegionMeta(
        name="locus_coeruleus",
        display_name="Locus coeruleus",
        zh_name="蓝斑核",
        # Small brainstem nucleus — placed below thalamus, near pons.
        position=(6.0, -14.0, -26.0),
        color="#38bdf8",
        role="Noradrenergic gain · uncertainty tracking",
        role_zh="去甲肾上腺素增益 · 追踪不确定性",
    )

    def __init__(self, window: int = 40):
        super().__init__()
        self.neurons_total = 40   # tiny in real biology
        self.window = window
        self.errors: Deque[float] = deque(maxlen=window)
        self.gain_scalar: float = 1.0
        self.tonic_rate: float = 0.2       # 0..1 tonic firing proxy

    def observe(self, prediction_error: float) -> float:
        """Called every tick with the NAcc's prediction error."""
        self.errors.append(abs(float(prediction_error)))
        if self.errors:
            mean_err = sum(self.errors) / len(self.errors)
            # Squash to a 1.0..1.6 multiplier — LC never fully quiets.
            self.gain_scalar = 1.0 + min(0.6, mean_err * 1.3)
            self.tonic_rate = min(1.0, mean_err * 1.5)
        act = min(1.0, self.tonic_rate * 0.9 + 0.15)
        self._set_activity(act, int(act * self.neurons_total))
        if self.gain_scalar > 1.4:
            self.note(f"NA release ↑ (gain {self.gain_scalar:.2f})")
        return self.gain_scalar

    def stats(self) -> dict:
        return {
            "gain": round(self.gain_scalar, 3),
            "tonic_rate": round(self.tonic_rate, 3),
            "recent_error_samples": len(self.errors),
        }

    def state_dict_serializable(self) -> dict:
        return {
            "errors": list(self.errors),
            "gain_scalar": self.gain_scalar,
            "tonic_rate": self.tonic_rate,
        }

    def load_state_dict_safe(self, sd: dict) -> None:
        try:
            self.errors = deque(sd.get("errors", []) or [], maxlen=self.window)
            self.gain_scalar = float(sd.get("gain_scalar", 1.0))
            self.tonic_rate = float(sd.get("tonic_rate", 0.2))
        except Exception:  # noqa: BLE001
            pass
