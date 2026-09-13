"""Entorhinal cortex — grid-cell state code.

Biologically, the entorhinal cortex is the interface between the
hippocampus and the rest of the neocortex. Layer II contains **grid
cells** that fire at the vertices of a hexagonal lattice tiling the
animal's environment — the discovery that won the 2014 Nobel Prize.
Modern theory extends grid coding beyond physical space to any
low-dimensional latent representation the animal has to navigate:
concept space, task space, market space.

Reference:
  Moser, E. I., Kropff, E. & Moser, M.-B. (2008) "Place cells, grid
  cells, and the brain's spatial representation system", Annu. Rev.
  Neurosci.
  Constantinescu, A. O., O'Reilly, J. X. & Behrens, T. E. J. (2016)
  "Organizing conceptual knowledge in humans with a gridlike code",
  Science.
  Whittington, J. C. R. et al. (2020) "The Tolman-Eichenbaum machine:
  unifying space and relational memory through generalization in the
  hippocampal formation", Cell.

Implementation: we fold the current 2-D agent position into a bank of
6 hexagonal grid modules with different spatial scales and orientations.
Each module outputs its own activation vector; concatenated they form a
16-D "grid code" the hippocampus can use as a stable index into episodic
memory. Purely analytic — no learning, no LLM, just cosines.
"""

from __future__ import annotations

import math
from typing import List, Tuple

import torch

from ..region import BrainRegion, RegionMeta


class EntorhinalCortex(BrainRegion):
    meta = RegionMeta(
        name="entorhinal_cortex",
        display_name="Entorhinal cortex",
        zh_name="内嗅皮层",
        # Medial temporal, front of hippocampus.
        position=(-24.0, -2.0, -12.0),
        color="#f59e0b",
        role="Grid-cell state code · cognitive map",
        role_zh="网格细胞状态编码 · 认知地图",
    )

    def __init__(self, num_modules: int = 6):
        super().__init__()
        self.neurons_total = 120
        self.num_modules = num_modules
        # Each module: (scale, orientation) — geometric-progression scales
        # and evenly-rotated orientations, as observed in rodents.
        self.modules: List[Tuple[float, float]] = []
        base_scale = 8.0
        for i in range(num_modules):
            scale = base_scale * (1.5 ** i)
            theta = (i / num_modules) * (math.pi / 3.0)  # 0..60°
            self.modules.append((scale, theta))
        self.last_code: torch.Tensor = torch.zeros(num_modules)
        self.step_count: int = 0

    def encode(self, position: Tuple[float, float]) -> torch.Tensor:
        """Map an (x, y) point to a `num_modules`-D grid code."""
        x, y = float(position[0]), float(position[1])
        code = []
        for scale, theta in self.modules:
            # Rotate coords, project onto three hex-axes 120° apart, sum.
            xr = x * math.cos(theta) - y * math.sin(theta)
            yr = x * math.sin(theta) + y * math.cos(theta)
            k = (2 * math.pi) / scale
            v = 0.0
            for phi in (0.0, 2 * math.pi / 3, 4 * math.pi / 3):
                v += math.cos(k * (xr * math.cos(phi) + yr * math.sin(phi)))
            code.append(v / 3.0)
        return torch.tensor(code, dtype=torch.float32)

    def observe(self, position: Tuple[float, float]) -> torch.Tensor:
        self.step_count += 1
        self.last_code = self.encode(position)
        # Activation = mean absolute grid response.
        act = float(min(1.0, self.last_code.abs().mean().item()))
        self._set_activity(act, int(act * self.neurons_total))
        if self.step_count % 60 == 0:
            self.note(f"grid code sampled @ ({position[0]}, {position[1]})")
        return self.last_code

    def stats(self) -> dict:
        return {
            "num_modules": self.num_modules,
            "code": [round(float(x), 3) for x in self.last_code.tolist()],
            "steps": self.step_count,
        }

    def state_dict_serializable(self) -> dict:
        return {
            "last_code": self.last_code.tolist(),
            "step_count": self.step_count,
        }

    def load_state_dict_safe(self, sd: dict) -> None:
        try:
            self.last_code = torch.tensor(
                sd.get("last_code", [0.0] * self.num_modules),
                dtype=torch.float32,
            )
            self.step_count = int(sd.get("step_count", 0))
        except Exception:  # noqa: BLE001
            pass
