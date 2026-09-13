"""Raphe nuclei — serotonin, patience, temporal discounting.

Biologically, the raphe nuclei sit along the brainstem midline and
project serotonin (5-HT) globally to the forebrain. Their activity
lengthens the "waiting horizon" — 5-HT neurons fire during periods when
the animal is patiently waiting for a delayed reward. Depleting 5-HT
makes animals impulsive; boosting it makes them wait longer for larger
rewards.

Reference:
  Doya, K. (2002) "Metalearning and neuromodulation", Neural Networks.
  Miyazaki, K., Miyazaki, K. W. & Doya, K. (2011) "Activation of dorsal
  raphe serotonin neurons underlies waiting for delayed rewards", J.
  Neurosci.
  Cools, R., Nakamura, K. & Daw, N. D. (2011) "Serotonin and dopamine:
  unifying affective, activational, and decision functions",
  Neuropsychopharmacology.

Implementation: we maintain a rolling "patience" state that rises when
positive rewards arrive predictably and falls when the environment turns
volatile. Downstream, patience *lowers* the effective discount rate
(brain values distant rewards more) and *dampens* impulsive Go bias in
the basal ganglia.
"""

from __future__ import annotations

from collections import deque
from typing import Deque

from ..region import BrainRegion, RegionMeta


class RapheNuclei(BrainRegion):
    meta = RegionMeta(
        name="raphe_nuclei",
        display_name="Raphe nuclei",
        zh_name="中缝核",
        # Brainstem midline, below LC.
        position=(0.0, -12.0, -30.0),
        color="#84cc16",
        role="Serotonin · patience · delay discounting",
        role_zh="5-HT · 耐心 · 延迟折扣",
    )

    def __init__(self, window: int = 50):
        super().__init__()
        self.neurons_total = 44
        self.window = window
        self.reward_hist: Deque[float] = deque(maxlen=window)
        self.patience: float = 0.5   # 0 = impulsive, 1 = very patient
        self.tonic_5ht: float = 0.5

    def observe(self, reward: float, pred_error: float) -> float:
        """Update patience from recent reward reliability."""
        self.reward_hist.append(float(reward))
        if len(self.reward_hist) >= 4:
            mean_r = sum(self.reward_hist) / len(self.reward_hist)
            # Volatility of reward over the window.
            var = sum((r - mean_r) ** 2 for r in self.reward_hist) / len(self.reward_hist)
            reliability = 1.0 / (1.0 + var * 2.0)   # low var → high reliability
            # Positive-mean reliable stream → patience rises.
            target = max(0.0, min(1.0, 0.3 + reliability * 0.6 + max(0.0, mean_r) * 0.4))
            # Exponential moving average toward target.
            self.patience += (target - self.patience) * 0.08
        # Tonic 5-HT is a slower EMA of patience.
        self.tonic_5ht += (self.patience - self.tonic_5ht) * 0.04
        self.patience = float(max(0.0, min(1.0, self.patience)))
        self.tonic_5ht = float(max(0.0, min(1.0, self.tonic_5ht)))
        act = min(1.0, self.tonic_5ht * 0.8 + 0.15)
        self._set_activity(act, int(act * self.neurons_total))
        if self.patience > 0.85:
            self.note(f"5-HT high — patient waiting ({self.patience:.2f})")
        elif self.patience < 0.2:
            self.note(f"5-HT low — impulsive ({self.patience:.2f})")
        return self.patience

    def discount_factor(self) -> float:
        """Effective RL discount γ — higher patience = brain cares more
        about distant future reward. Range 0.90..0.995."""
        return 0.90 + 0.095 * self.patience

    def impulse_dampen(self) -> float:
        """Multiplier applied to basal-ganglia Go bias. Patient brain
        shrinks the bias toward 0.5 so it doesn't chase every winner."""
        return 1.0 - 0.35 * self.patience

    def stats(self) -> dict:
        return {
            "patience": round(self.patience, 3),
            "tonic_5ht": round(self.tonic_5ht, 3),
            "discount_gamma": round(self.discount_factor(), 4),
            "samples": len(self.reward_hist),
        }

    def state_dict_serializable(self) -> dict:
        return {
            "reward_hist": list(self.reward_hist),
            "patience": self.patience,
            "tonic_5ht": self.tonic_5ht,
        }

    def load_state_dict_safe(self, sd: dict) -> None:
        try:
            self.reward_hist = deque(sd.get("reward_hist", []) or [], maxlen=self.window)
            self.patience = float(sd.get("patience", 0.5))
            self.tonic_5ht = float(sd.get("tonic_5ht", 0.5))
        except Exception:  # noqa: BLE001
            pass
