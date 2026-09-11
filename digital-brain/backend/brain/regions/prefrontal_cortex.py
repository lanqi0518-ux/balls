"""Dorsolateral & ventromedial prefrontal cortex — decision-making.

A small actor-critic network fed by the fully-formed 'thought vector'
assembled from visual features, recalled memory, fear, and motivation. It
produces:

  * action logits — the intended plan (dlPFC role)
  * a state value estimate — 'how good is this situation' (vmPFC role)

This is the region that turns integrated cortical input into a *choice*.
It is trained online with a simple REINFORCE-with-baseline rule.
"""

from __future__ import annotations

import math
import torch
import torch.nn as nn
import torch.nn.functional as F

from ..region import BrainRegion, RegionMeta, _count_active


class PrefrontalCortex(BrainRegion):
    meta = RegionMeta(
        name="prefrontal_cortex",
        display_name="Prefrontal cortex (dl + vm)",
        zh_name="前额叶皮层",
        position=(0.0, 65.0, 25.0),
        color="#38bdf8",
        role="Weighs options, plans, decides",
        role_zh="权衡选项、规划、决策",
    )

    def __init__(self, input_dim: int, num_actions: int, hidden: int = 96,
                 lr: float = 5e-3):
        super().__init__()
        self.input_dim = input_dim
        self.num_actions = num_actions
        self.trunk = nn.Sequential(
            nn.Linear(input_dim, hidden),
            nn.Tanh(),
            nn.Linear(hidden, hidden),
            nn.Tanh(),
        )
        self.policy_head = nn.Linear(hidden, num_actions)
        self.value_head = nn.Linear(hidden, 1)
        self.optim = torch.optim.Adam(self.parameters_iter(), lr=lr)
        self.neurons_total = hidden * 2 + num_actions + 1

    def parameters_iter(self):
        yield from self.trunk.parameters()
        yield from self.policy_head.parameters()
        yield from self.value_head.parameters()

    def forward(self, thought_vector: torch.Tensor):
        h = self.trunk(thought_vector)
        logits = self.policy_head(h)
        value = self.value_head(h).squeeze(-1)
        act = float(h.abs().mean().item())
        self._set_activity(min(1.0, act * 1.5), _count_active(h))
        return logits, value, h

    def learn(self, log_prob: torch.Tensor, value: torch.Tensor,
              reward: float, next_value: float, gamma: float = 0.9) -> float:
        """One-step actor-critic update. Returns loss."""
        target = reward + gamma * next_value
        advantage = target - value.detach()
        policy_loss = -log_prob * advantage
        value_loss = F.smooth_l1_loss(value, torch.tensor(float(target)))
        loss = policy_loss + 0.5 * value_loss
        self.optim.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(list(self.parameters_iter()), 1.0)
        self.optim.step()
        return float(loss.item())
