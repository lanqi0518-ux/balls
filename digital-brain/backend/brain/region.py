"""Base class for every brain region.

Every region has:
  * an anatomical name and a 3D position (used for visualisation)
  * a live `activation` scalar in [0, 1] and a `neurons_active` count
  * a `state()` snapshot that the WebSocket layer streams to the browser

Concrete regions implement `forward(...)` and are otherwise free to expose
whatever helpers they need to their peers on the Brain.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple

import torch


@dataclass
class RegionMeta:
    """Anatomical metadata about a region, mirrored to the frontend so that
    the 3D brain visualisation can position and colour each blob correctly.
    """

    name: str            # anatomical id, e.g. "hippocampus"
    display_name: str    # nice label, e.g. "Hippocampus"
    zh_name: str         # 中文名 for the UI
    position: Tuple[float, float, float]  # (x, y, z) in brain-space (mm-ish)
    color: str           # hex accent used both in 3D and the UI
    role: str            # one-line functional description
    role_zh: str


class BrainRegion:
    """Abstract superclass. Subclasses implement the actual computation."""

    meta: RegionMeta

    def __init__(self):
        self.activation: float = 0.0
        self.neurons_active: int = 0
        self.neurons_total: int = 0
        self._recent_events: List[str] = []

    def note(self, event: str) -> None:
        """Push a short human-readable event into this region's mini log."""
        self._recent_events.append(event)
        if len(self._recent_events) > 6:
            self._recent_events.pop(0)

    def _set_activity(self, activation: float, active_neurons: int | None = None) -> None:
        self.activation = float(max(0.0, min(1.0, activation)))
        if active_neurons is not None:
            self.neurons_active = int(active_neurons)

    def state(self) -> Dict:
        return {
            "name": self.meta.name,
            "display_name": self.meta.display_name,
            "zh_name": self.meta.zh_name,
            "position": list(self.meta.position),
            "color": self.meta.color,
            "role": self.meta.role,
            "role_zh": self.meta.role_zh,
            "activation": round(self.activation, 3),
            "neurons_active": self.neurons_active,
            "neurons_total": self.neurons_total,
            "recent": list(self._recent_events),
        }


def _count_active(t: torch.Tensor, threshold: float = 0.05) -> int:
    return int((t.detach().abs() > threshold).sum().item())
