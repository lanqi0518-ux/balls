"""Posterior parietal cortex (PPC) — evidence accumulator.

Biologically, PPC (specifically area LIP) contains neurons whose firing
rate ramps upward as evidence for a particular perceptual choice
accumulates over time. When the ramp crosses a threshold, the animal
commits to that choice. This is the neural substrate of the classic
drift-diffusion decision model.

Reference:
  Shadlen, M. N. & Newsome, W. T. (2001) "Neural basis of a perceptual
  decision in the parietal cortex", J. Neurophysiol.
  Gold, J. I. & Shadlen, M. N. (2007) "The neural basis of decision
  making", Annu. Rev. Neurosci.
  Ratcliff, R. & McKoon, G. (2008) "The diffusion decision model: theory
  and data for two-choice decision tasks", Neural Comp.

Implementation: for each of the N possible actions we maintain a scalar
accumulator that drifts each tick by the (softmax-normalized) evidence
from PFC logits, and leaks a bit toward zero every tick. When the max
accumulator crosses `commit_threshold`, we emit a "commit" signal that
PFC can use to sharpen its confidence.
"""

from __future__ import annotations

from typing import List

import torch

from ..region import BrainRegion, RegionMeta


class PosteriorParietal(BrainRegion):
    meta = RegionMeta(
        name="posterior_parietal",
        display_name="Posterior parietal",
        zh_name="后顶叶皮层",
        # Dorsal, back-top, right of midline.
        position=(22.0, -25.0, 48.0),
        color="#06b6d4",
        role="Evidence accumulator · drift-diffusion",
        role_zh="证据累积 · 漂移-扩散决策",
    )

    def __init__(self, num_actions: int = 5,
                 leak: float = 0.85,
                 drift_gain: float = 0.30,
                 commit_threshold: float = 1.2):
        super().__init__()
        self.neurons_total = 96
        self.num_actions = num_actions
        self.leak = leak
        self.drift_gain = drift_gain
        self.commit_threshold = commit_threshold
        self.accumulators: List[float] = [0.0] * num_actions
        self.commits: int = 0
        self.last_commit_action: int = -1
        self.max_accum: float = 0.0

    def observe(self, action_probs: torch.Tensor) -> float:
        """Drift-diffusion one tick. Returns 0..1 commitment scalar."""
        probs = action_probs.detach().tolist()
        centered = [p - (1.0 / self.num_actions) for p in probs]
        # Leak toward zero, then add drift.
        self.accumulators = [
            self.leak * a + self.drift_gain * c
            for a, c in zip(self.accumulators, centered)
        ]
        self.max_accum = float(max(self.accumulators))
        best_action = int(max(range(self.num_actions),
                              key=lambda i: self.accumulators[i]))
        if self.max_accum >= self.commit_threshold:
            self.commits += 1
            if best_action != self.last_commit_action:
                self.note(f"commit → action {best_action} (accum {self.max_accum:.2f})")
            self.last_commit_action = best_action
            # After committing, drain accumulators to reset the race.
            self.accumulators = [a * 0.2 for a in self.accumulators]
        commitment = min(1.0, self.max_accum / self.commit_threshold)
        act = commitment
        self._set_activity(act, int(act * self.neurons_total))
        return commitment

    def sharpen_boost(self) -> float:
        """Additive term PFC's chosen-action logit can receive when PPC
        has fully committed. Zero when still deliberating."""
        return 0.5 if self.max_accum >= self.commit_threshold else 0.0

    def stats(self) -> dict:
        return {
            "accumulators": [round(a, 3) for a in self.accumulators],
            "max_accum": round(self.max_accum, 3),
            "commits_total": self.commits,
            "last_commit_action": self.last_commit_action,
        }

    def state_dict_serializable(self) -> dict:
        return {
            "accumulators": list(self.accumulators),
            "commits": self.commits,
            "last_commit_action": self.last_commit_action,
            "max_accum": self.max_accum,
        }

    def load_state_dict_safe(self, sd: dict) -> None:
        try:
            acc = sd.get("accumulators") or []
            self.accumulators = [
                float(acc[i]) if i < len(acc) else 0.0
                for i in range(self.num_actions)
            ]
            self.commits = int(sd.get("commits", 0))
            self.last_commit_action = int(sd.get("last_commit_action", -1))
            self.max_accum = float(sd.get("max_accum", 0.0))
        except Exception:  # noqa: BLE001
            pass
