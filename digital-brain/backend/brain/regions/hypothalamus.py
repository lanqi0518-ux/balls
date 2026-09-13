"""Hypothalamus — homeostatic drives.

Biologically, the hypothalamus is the brain's set-point regulator: it
tracks internal state variables (energy, temperature, arousal, circadian
phase) and drives motivated behaviour toward whichever variable is
furthest from its set point.

Reference:
  Sternson, S. M. (2013) "Hypothalamic survival circuits: blueprints for
  purposive behaviors", Neuron.
  Berridge, K. C. (2004) "Motivation concepts in behavioral neuroscience",
  Physiology & Behavior.
  Keramati, M. & Gutkin, B. (2014) "Homeostatic reinforcement learning
  for integrating reward collection and physiological stability", eLife.

Implementation: we maintain two internal set-point variables — an
"energy" scalar (drifts down when the brain is idle, replenished by
reward events) and an "arousal" scalar (drifts down over time, boosted
by fear or surprise). The scalar ``drive`` = distance-from-setpoint;
downstream, it *adds* to engagement so a bored brain still keeps
exploring even when reward has been flat.
"""

from __future__ import annotations

import time

from ..region import BrainRegion, RegionMeta


class Hypothalamus(BrainRegion):
    meta = RegionMeta(
        name="hypothalamus",
        display_name="Hypothalamus",
        zh_name="下丘脑",
        # Just below the thalamus.
        position=(0.0, 4.0, -14.0),
        color="#14b8a6",
        role="Homeostatic drives · energy · arousal",
        role_zh="内稳态驱动 · 能量 · 觉醒",
    )

    def __init__(self,
                 setpoint_energy: float = 0.6,
                 setpoint_arousal: float = 0.5,
                 decay: float = 0.995):
        super().__init__()
        self.neurons_total = 56
        self.setpoint_energy = setpoint_energy
        self.setpoint_arousal = setpoint_arousal
        self.decay = decay
        self.energy: float = setpoint_energy
        self.arousal: float = setpoint_arousal
        self.drive: float = 0.0
        self.last_update_s: float = time.time()

    def observe(self, reward: float, fear: float,
                 surprise: float) -> float:
        """Tick the homeostatic variables. Returns the drive scalar."""
        # Energy: slowly decays toward zero, replenished by |reward|.
        self.energy = self.energy * self.decay + 0.02 * abs(float(reward))
        self.energy = max(0.0, min(1.0, self.energy))
        # Arousal: decays, boosted by fear + surprise.
        self.arousal = self.arousal * self.decay + \
                        0.03 * float(fear) + 0.03 * float(surprise)
        self.arousal = max(0.0, min(1.0, self.arousal))
        # Drive = summed distance from set-points, so both an overfed
        # and an underfed brain get a nudge back toward baseline.
        d_e = abs(self.energy - self.setpoint_energy)
        d_a = abs(self.arousal - self.setpoint_arousal)
        self.drive = float(min(1.0, (d_e + d_a) * 0.7))
        act = min(1.0, self.drive * 0.9 + 0.15)
        self._set_activity(act, int(act * self.neurons_total))
        if self.energy < 0.2:
            self.note(f"energy low ({self.energy:.2f}) — seek reward")
        elif self.arousal < 0.2:
            self.note(f"arousal low ({self.arousal:.2f}) — seek novelty")
        return self.drive

    def engagement_boost(self) -> float:
        """Small additive boost so a homeostatically-imbalanced brain
        keeps exploring even when nothing is happening externally."""
        return 0.15 * self.drive

    def stats(self) -> dict:
        return {
            "energy": round(self.energy, 3),
            "arousal": round(self.arousal, 3),
            "drive": round(self.drive, 3),
            "setpoint_energy": self.setpoint_energy,
            "setpoint_arousal": self.setpoint_arousal,
        }

    def state_dict_serializable(self) -> dict:
        return {
            "energy": self.energy,
            "arousal": self.arousal,
            "drive": self.drive,
        }

    def load_state_dict_safe(self, sd: dict) -> None:
        try:
            self.energy = float(sd.get("energy", self.setpoint_energy))
            self.arousal = float(sd.get("arousal", self.setpoint_arousal))
            self.drive = float(sd.get("drive", 0.0))
        except Exception:  # noqa: BLE001
            pass
