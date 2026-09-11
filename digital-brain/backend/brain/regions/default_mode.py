"""Default mode network — 'mind-wandering' during idle moments.

When the agent is not actively pursuing something interesting (low novelty,
low reward-prediction-error), the DMN begins to reactivate hippocampal
memories at random. This models the well-known phenomenon that human DMN
activity is inversely correlated with task engagement, and is thought to
support memory consolidation and imagination.
"""

from __future__ import annotations

import math
import random
import time
from typing import Optional

import torch

from ..region import BrainRegion, RegionMeta
from .hippocampus import Hippocampus


class DefaultModeNetwork(BrainRegion):
    meta = RegionMeta(
        name="default_mode",
        display_name="Default mode network",
        zh_name="默认网络",
        position=(0.0, 25.0, 35.0),
        color="#c084fc",
        role="Idle-time memory replay, imagination, self-reflection",
        role_zh="空闲时的记忆回放、想象、自省",
    )

    def __init__(self):
        super().__init__()
        self.last_replay_step: int = -1
        self.replay_cue: Optional[torch.Tensor] = None
        self.neurons_total = 120

    def tick(self, task_engagement: float, hippocampus: Hippocampus,
             step: int) -> Optional[torch.Tensor]:
        """Called every timestep. Occasionally replays a random memory.

        Returns a feature cue that downstream regions can use to 'imagine' the
        replayed episode. When there's no replay, returns None.
        """
        # Idle level = inverse of engagement (with a floor).
        idle = 1.0 - min(1.0, task_engagement)
        base = 0.15 + 0.35 * idle + 0.05 * math.sin(time.time() * 1.7)
        self._set_activity(base, int(base * self.neurons_total))

        # Replay a random memory with probability proportional to how idle we are.
        if hippocampus.memory and random.random() < 0.05 * idle:
            ep = random.choice(hippocampus.memory)
            self.replay_cue = ep.features.clone()
            self.last_replay_step = step
            emo = "positive" if ep.valence > 0 else ("negative" if ep.valence < 0 else "neutral")
            self.note(f"replaying {emo} memory from t={ep.step}")
            self._set_activity(min(1.0, base + 0.4))
            return self.replay_cue

        return None
