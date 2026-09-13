"""Ventral tegmental area (VTA) — dopaminergic burst source.

Biologically, VTA is the midbrain nucleus whose ~500k dopamine neurons
project to nucleus accumbens, prefrontal cortex, hippocampus, and
amygdala. Its phasic bursts encode reward prediction error and are the
teaching signal every striatal circuit downstream uses to update value
estimates. Where NAcc *reads* dopamine to update the reward baseline,
VTA *sources* it.

Reference:
  Schultz, W., Dayan, P. & Montague, P. R. (1997) "A neural substrate of
  prediction and reward", Science.
  Bromberg-Martin, E. S., Matsumoto, M. & Hikosaka, O. (2010) "Dopamine
  in motivational control", Neuron.
  Steinberg, E. E. et al. (2013) "A causal link between prediction errors,
  dopamine neurons and learning", Nat. Neurosci.

Implementation: we count phasic *bursts* (|RPE| > threshold) and *dips*
(RPE < -threshold), maintain a rolling tonic firing rate, and expose a
per-tick "burst amplitude" that other regions can use to gate learning
rate. When VTA is bursting hard, plasticity everywhere else is turned up.
"""

from __future__ import annotations

from collections import deque
from typing import Deque

from ..region import BrainRegion, RegionMeta


class VentralTegmental(BrainRegion):
    meta = RegionMeta(
        name="ventral_tegmental",
        display_name="Ventral tegmental area",
        zh_name="腹侧被盖区",
        # Midbrain, deep center, slightly below thalamus.
        position=(0.0, -2.0, -22.0),
        color="#d946ef",
        role="Dopamine source · phasic reward bursts",
        role_zh="多巴胺源 · 相位奖励脉冲",
    )

    def __init__(self, window: int = 60, burst_threshold: float = 0.45):
        super().__init__()
        self.neurons_total = 64
        self.window = window
        self.burst_threshold = burst_threshold
        self.rpe_hist: Deque[float] = deque(maxlen=window)
        self.tonic_rate: float = 0.15
        self.last_burst: float = 0.0
        self.bursts_total: int = 0
        self.dips_total: int = 0

    def observe(self, pred_error: float) -> float:
        """Called each tick with NAcc's reward-prediction error.
        Returns the burst-amplitude scalar in [0, 1]."""
        rpe = float(pred_error)
        self.rpe_hist.append(rpe)
        # Phasic burst / dip counting.
        if rpe > self.burst_threshold:
            self.bursts_total += 1
        elif rpe < -self.burst_threshold:
            self.dips_total += 1
        # Tonic rate = rolling mean magnitude of RPE.
        if self.rpe_hist:
            mag = sum(abs(x) for x in self.rpe_hist) / len(self.rpe_hist)
            self.tonic_rate = float(min(1.0, mag * 1.4))
        self.last_burst = float(min(1.0, abs(rpe)))
        act = min(1.0, self.last_burst * 0.9 + self.tonic_rate * 0.35)
        self._set_activity(act, int(act * self.neurons_total))
        if abs(rpe) > 0.8:
            direction = "burst" if rpe > 0 else "dip"
            self.note(f"phasic {direction} (Δ={rpe:+.2f})")
        return self.last_burst

    def plasticity_gain(self) -> float:
        """Multiplier downstream learners can scale their LR by.
        High phasic activity → learn faster right now."""
        return 1.0 + 0.5 * self.last_burst

    def stats(self) -> dict:
        return {
            "burst": round(self.last_burst, 3),
            "tonic_rate": round(self.tonic_rate, 3),
            "bursts_total": self.bursts_total,
            "dips_total": self.dips_total,
        }

    def state_dict_serializable(self) -> dict:
        return {
            "rpe_hist": list(self.rpe_hist),
            "tonic_rate": self.tonic_rate,
            "last_burst": self.last_burst,
            "bursts_total": self.bursts_total,
            "dips_total": self.dips_total,
        }

    def load_state_dict_safe(self, sd: dict) -> None:
        try:
            self.rpe_hist = deque(sd.get("rpe_hist", []) or [], maxlen=self.window)
            self.tonic_rate = float(sd.get("tonic_rate", 0.15))
            self.last_burst = float(sd.get("last_burst", 0.0))
            self.bursts_total = int(sd.get("bursts_total", 0))
            self.dips_total = int(sd.get("dips_total", 0))
        except Exception:  # noqa: BLE001
            pass
