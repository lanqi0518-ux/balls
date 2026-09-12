"""Cerebellum — forward-model / calibration.

Biologically, the cerebellum receives an efference copy of every motor
command and the resulting sensory outcome. It learns a forward model
(what should happen if I do X) and reports the *prediction error* between
expected and actual outcomes. That error is what makes motor control
smooth: badly-calibrated forward models produce jerky, over- or
under-shooting movements.

Reference:
    10|  Wolpert, Miall & Kawato (1998) "Internal models in the cerebellum",
  Trends in Cognitive Sciences.
  Ito (2008) "Control of mental activities by internal models in the
  cerebellum", Nat. Rev. Neurosci.

Implementation: at every step we receive (predicted_value, actual_reward)
and maintain a rolling MSE. The scalar ``calibration`` ∈ [0,1] reflects
how well the PFC's critic head is predicting reward right now.  Well-
calibrated → 1.0, badly calibrated → 0.0.  Downstream, the motor cortex
uses this to dampen confidence when the brain's own predictions have
    20|been off recently — a computational analogue of cerebellar smoothing.
"""

from __future__ import annotations

from collections import deque
from typing import Deque

from ..region import BrainRegion, RegionMeta


class Cerebellum(BrainRegion):
    meta = RegionMeta(
        name="cerebellum",
        display_name="Cerebellum",
        zh_name="小脑",
        # Behind and below the brainstem — anatomically correct.
        position=(0.0, -18.0, -34.0),
        color="#a78bfa",
        role="Forward model + motor calibration",
        role_zh="正向模型与运动校准",
    )

    def __init__(self, window: int = 60):
        super().__init__()
        self.neurons_total = 96
        self.window = window
        self.errors: Deque[float] = deque(maxlen=window)
        self.last_error: float = 0.0
        self.calibration: float = 1.0        # 1 = perfect, 0 = miscalibrated
        self.total_updates: int = 0

    def observe(self, predicted_value: float, actual_reward: float) -> float:
        """Called every tick with the PFC critic's value estimate and
        the reward that actually arrived. Updates the forward-model
        error and the calibration scalar."""
        err = float(actual_reward) - float(predicted_value)
        self.errors.append(err * err)
        self.last_error = err
        self.total_updates += 1
        if self.errors:
            mse = sum(self.errors) / len(self.errors)
            # tanh squash — mse=0 → cal=1, mse=1 → cal≈0.24
            self.calibration = float(max(0.0, 1.0 - min(1.0, mse ** 0.5)))
        # Activity spikes on surprise, resting glow when calibration is high.
        act = min(1.0, abs(err) * 1.2 + self.calibration * 0.15)
        self._set_activity(act, int(act * self.neurons_total))
        if abs(err) > 1.2:
            self.note(f"forward-model surprise Δ={err:+.2f}")
        return self.calibration

    def gain(self) -> float:
        """Return the motor-gain scalar downstream regions apply.

        1.0 when the forward model is well-calibrated (trust the plan);
        0.6 when calibration collapses (dampen commitment)."""
        return 0.6 + 0.4 * self.calibration

    def stats(self) -> dict:
        return {
            "calibration": round(self.calibration, 3),
            "last_error": round(self.last_error, 3),
            "samples": len(self.errors),
            "updates_total": self.total_updates,
        }

    def state_dict_serializable(self) -> dict:
        return {
            "errors": list(self.errors),
            "last_error": self.last_error,
            "calibration": self.calibration,
            "total_updates": self.total_updates,
        }

    def load_state_dict_safe(self, sd: dict) -> None:
        try:
            self.errors = deque(sd.get("errors", []) or [], maxlen=self.window)
            self.last_error = float(sd.get("last_error", 0.0))
            self.calibration = float(sd.get("calibration", 1.0))
            self.total_updates = int(sd.get("total_updates", 0))
        except Exception:  # noqa: BLE001
            pass
