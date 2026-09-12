"""Basal ganglia — action gating (Direct / Indirect / Hyperdirect).

Biologically, the basal ganglia sit between the cortex and thalamus and
implement action selection through parallel Go / NoGo pathways. The
direct (Go) pathway facilitates a candidate action; the indirect (NoGo)
pathway suppresses competitors; the hyperdirect pathway can slam an
emergency brake on the whole thing. Dopamine from the substantia nigra
biases the direct/indirect balance based on recent reward history.

    10|Reference:
  Frank, M. J. (2005) "Dynamic dopamine modulation in the basal ganglia:
  a neurocomputational account of cognitive deficits in medicated and
  nonmedicated Parkinsonism", J. Cog. Neurosci.
  Cui, G. et al. (2013) "Concurrent activation of striatal direct and
  indirect pathways during action initiation", Nature.

Implementation: for each of the N possible motor actions we keep a
rolling reward baseline. Before the motor cortex samples, we shift the
PFC's action logits by the (rescaled) per-action baseline — actions that
    20|have been losing recently are damped, winners are boosted. This is a
tiny, differentiable-in-effect analogue of the striatal Go/NoGo balance.
"""

from __future__ import annotations

from collections import deque
from typing import Deque, Dict, List

import torch

from ..region import BrainRegion, RegionMeta


class BasalGanglia(BrainRegion):
    meta = RegionMeta(
        name="basal_ganglia",
        display_name="Basal ganglia",
        zh_name="基底神经节",
        # Deep in the forebrain, around the thalamus.
        position=(-10.0, 4.0, -8.0),
        color="#f472b6",
        role="Action gating · Go / NoGo pathways",
        role_zh="动作门控 · 直接/间接通路",
    )

    def __init__(self, num_actions: int = 5, window: int = 40,
                 gate_scale: float = 0.35):
        super().__init__()
        self.neurons_total = 80
        self.num_actions = num_actions
        self.window = window
        self.gate_scale = gate_scale
        self.reward_hist: List[Deque[float]] = [
            deque(maxlen=window) for _ in range(num_actions)
        ]
        self.last_bias: List[float] = [0.0] * num_actions
        self.gates_total: int = 0
        self.last_gated_action: int = -1

    def credit(self, action: int, reward: float) -> None:
        """Update the reward baseline for the action that was just executed."""
        if 0 <= action < self.num_actions:
            self.reward_hist[action].append(float(reward))
            self.last_gated_action = int(action)

    def _mean_reward(self, a: int) -> float:
        buf = self.reward_hist[a]
        return (sum(buf) / len(buf)) if buf else 0.0

    def gate(self, logits: torch.Tensor) -> torch.Tensor:
        """Shift the PFC's action logits by per-action reward history.

        Positive rolling reward on action `a` adds to its logit; negative
        subtracts. The shift is bounded so a single bad streak never
        completely disables an action — exploration still survives.
        """
        biases: List[float] = []
        for a in range(self.num_actions):
            r = self._mean_reward(a)
            # Bounded tanh-scaled bias so a single unlucky streak can't
            # zero out an action forever.
            b = self.gate_scale * torch.tanh(torch.tensor(r * 0.8)).item()
            biases.append(b)
        self.last_bias = biases
        self.gates_total += 1
        act = min(1.0, max(abs(x) for x in biases) / max(1e-6, self.gate_scale))
        self._set_activity(act, int(act * self.neurons_total))
        if act > 0.5 and self.gates_total % 20 == 0:
            self.note("gating: strong bias vector active")
        shift = torch.tensor(biases, dtype=logits.dtype, device=logits.device)
        return logits + shift

    def stats(self) -> dict:
        return {
            "num_actions": self.num_actions,
            "gates_total": self.gates_total,
            "last_bias": [round(b, 3) for b in self.last_bias],
            "action_mean_reward": [round(self._mean_reward(a), 3)
                                    for a in range(self.num_actions)],
        }

    def state_dict_serializable(self) -> dict:
        return {
            "reward_hist": [list(d) for d in self.reward_hist],
            "last_bias": list(self.last_bias),
            "gates_total": self.gates_total,
            "last_gated_action": self.last_gated_action,
        }

    def load_state_dict_safe(self, sd: dict) -> None:
        try:
            hist = sd.get("reward_hist") or []
            self.reward_hist = [
                deque((hist[a] if a < len(hist) else []), maxlen=self.window)
                for a in range(self.num_actions)
            ]
            self.last_bias = list(sd.get("last_bias") or [0.0] * self.num_actions)
            self.gates_total = int(sd.get("gates_total", 0))
            self.last_gated_action = int(sd.get("last_gated_action", -1))
        except Exception:  # noqa: BLE001
            pass
