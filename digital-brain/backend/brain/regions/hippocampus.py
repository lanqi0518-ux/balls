"""Hippocampus — episodic memory as a modern Hopfield / kNN memory bank.

Every 'experience' the brain has (a feature vector from the visual cortex,
together with the emotional state at that moment) is stored here. When the
brain sees something new, the hippocampus retrieves the *most similar* past
experience — a rough analogue of pattern completion in real hippocampal CA3.

This gives the whole system a functional episodic memory: it can 'recall'
"I've been somewhere like this before, and it felt X".

It also holds a separate **knowledge bank**: permanent semantic memories
seeded at boot (e.g. crypto and Einstein concepts). Knowledge entries are
never evicted, and always participate in recall.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

import torch
import torch.nn.functional as F

from ..region import BrainRegion, RegionMeta


@dataclass
class Episode:
    features: torch.Tensor    # feature vector this memory is keyed on
    valence: float            # +1 good, -1 bad, 0 neutral
    fear: float               # emotional colour at storage time
    location: tuple           # optional: agent position when stored
    step: int                 # global timestep (-1 for permanent knowledge)
    # Optional metadata used by the knowledge bank:
    label: Optional[str] = None    # e.g. "btc"
    tag: str = "episode"           # "episode" | "knowledge"
    category: Optional[str] = None # e.g. "crypto_core"


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
        self.memory: List[Episode] = []          # episodic, FIFO-evicted
        self.knowledge: List[Episode] = []       # permanent, never evicted
        self.last_similarity: float = 0.0
        self.last_recalled_idx: Optional[int] = None
        self.last_recalled_tag: str = "episode"
        self.neurons_total = capacity

    # ------------------------------------------------------------------
    # Storage
    # ------------------------------------------------------------------
    def store(self, features: torch.Tensor, valence: float, fear: float,
              location: tuple, step: int) -> None:
        """Store a normal episodic memory (evictable)."""
        if self.memory:
            last = self.memory[-1]
            sim = F.cosine_similarity(features.unsqueeze(0), last.features.unsqueeze(0)).item()
            if sim > 0.98 and abs(valence - last.valence) < 0.1:
                return
        ep = Episode(features=features.detach().clone(),
                     valence=float(valence), fear=float(fear),
                     location=location, step=step, tag="episode")
        self.memory.append(ep)
        if len(self.memory) > self.capacity:
            self.memory.pop(0)

    def store_knowledge(self, features: torch.Tensor, label: str,
                        category: str) -> None:
        """Store a permanent knowledge memory. Never evicted."""
        ep = Episode(features=features.detach().clone(),
                     valence=0.0, fear=0.0,
                     location=(-1, -1), step=-1,
                     label=label, tag="knowledge", category=category)
        self.knowledge.append(ep)

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------
    def _combined(self) -> List[Episode]:
        return self.memory + self.knowledge

    def recall(self, cue: torch.Tensor) -> Optional[Episode]:
        pool = self._combined()
        if not pool:
            self._set_activity(0.0, 0)
            self.last_similarity = 0.0
            self.last_recalled_idx = None
            self.last_recalled_tag = "episode"
            return None
        stacked = torch.stack([m.features for m in pool])
        sims = F.cosine_similarity(cue.unsqueeze(0), stacked, dim=-1)
        idx = int(sims.argmax().item())
        best = float(sims[idx].item())
        self.last_similarity = best
        self.last_recalled_idx = idx
        ep = pool[idx]
        self.last_recalled_tag = ep.tag
        self._set_activity(max(0.05, best), active_neurons=len(pool))
        return ep

    def associate_knowledge(self, cue: torch.Tensor,
                            temperature: float = 2.0
                            ) -> Optional[tuple]:
        """Sample one knowledge concept, biased toward those most similar to the cue.

        Returns (Episode, similarity_score) or None if the knowledge bank is empty.
        Unlike ``recall``, this always draws from the knowledge bank only, and
        returns a *sampled* concept rather than the strict argmax — so the brain
        wanders over related ideas instead of always fixating on one.
        """
        if not self.knowledge:
            return None
        stacked = torch.stack([m.features for m in self.knowledge])
        sims = F.cosine_similarity(cue.unsqueeze(0), stacked, dim=-1)
        probs = F.softmax(sims * temperature, dim=0)
        idx = int(torch.multinomial(probs, 1).item())
        return self.knowledge[idx], float(sims[idx].item())

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------
    def stats(self) -> dict:
        return {
            "memories": len(self.memory),
            "knowledge": len(self.knowledge),
            "capacity": self.capacity,
            "last_similarity": round(self.last_similarity, 3),
            "last_recalled_tag": self.last_recalled_tag,
        }
