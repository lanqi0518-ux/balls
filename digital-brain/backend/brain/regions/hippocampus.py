"""Hippocampus — episodic memory as a modern Hopfield / kNN memory bank.

Every 'experience' the brain has (a feature vector from the visual cortex,
together with the emotional state at that moment) is stored here. When the
brain sees something new, the hippocampus retrieves the *most similar* past
experience — a rough analogue of pattern completion in real hippocampal CA3.

This gives the whole system a functional episodic memory: it can 'recall'
"I've been somewhere like this before, and it felt X".
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import torch
import torch.nn.functional as F

from ..region import BrainRegion, RegionMeta


@dataclass
class Episode:
    features: torch.Tensor    # visual feature vector
    valence: float            # +1 good, -1 bad, 0 neutral
    fear: float
    location: tuple           # optional: agent position when stored
    step: int                 # global timestep


class Hippocampus(BrainRegion):
    meta = RegionMeta(
        name="hippocampus",
        display_name="Hippocampus",
        zh_name="海马体",
        position=(-25.0, -10.0, -15.0),
        color="#fbbf24",
        role="Stores and retrieves episodic memories",
        role_zh="储存与提取情景记忆",
    )

    def __init__(self, feature_dim: int = 32, capacity: int = 200):
        super().__init__()
        self.capacity = capacity
        self.feature_dim = feature_dim
        self.memory: List[Episode] = []
        self.last_similarity: float = 0.0
        self.last_recalled_idx: Optional[int] = None
        self.neurons_total = capacity

    def store(self, features: torch.Tensor, valence: float, fear: float,
              location: tuple, step: int) -> None:
        # Only store if this experience is meaningfully different from the
        # most recent one (avoids filling memory with near-duplicates while
        # sitting still).
        if self.memory:
            last = self.memory[-1]
            sim = F.cosine_similarity(features.unsqueeze(0), last.features.unsqueeze(0)).item()
            if sim > 0.98 and abs(valence - last.valence) < 0.1:
                return
        ep = Episode(features=features.detach().clone(),
                     valence=float(valence), fear=float(fear),
                     location=location, step=step)
        self.memory.append(ep)
        if len(self.memory) > self.capacity:
            self.memory.pop(0)

    def recall(self, cue: torch.Tensor) -> Optional[Episode]:
        if not self.memory:
            self._set_activity(0.0, 0)
            self.last_similarity = 0.0
            self.last_recalled_idx = None
            return None
        stacked = torch.stack([m.features for m in self.memory])
        sims = F.cosine_similarity(cue.unsqueeze(0), stacked, dim=-1)
        idx = int(sims.argmax().item())
        best = float(sims[idx].item())
        self.last_similarity = best
        self.last_recalled_idx = idx
        # Activation is proportional to retrieval confidence.
        self._set_activity(max(0.05, best), active_neurons=len(self.memory))
        return self.memory[idx]

    def stats(self) -> dict:
        return {
            "memories": len(self.memory),
            "capacity": self.capacity,
            "last_similarity": round(self.last_similarity, 3),
        }
