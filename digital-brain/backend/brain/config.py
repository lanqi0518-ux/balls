"""BrainConfig — dial the digital brain up or down.

The digital brain has two presets:

* **default** — small and lean, ~200-memory hippocampus, 96-wide PFC.
* **einstein** — bigger cortex (192-wide PFC), longer memory (400 slots),
  more restless default-mode network, and the crypto+Einstein knowledge
  bank pre-loaded into the hippocampus at boot.

The active preset is chosen at boot via the ``BRAIN_MODE`` environment
variable (default: ``einstein``). A separate ``BRAIN_KNOWLEDGE`` variable
can force the knowledge bank on or off independent of mode.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, asdict


@dataclass
class BrainConfig:
    mode: str = "einstein"
    feature_dim: int = 32
    pfc_hidden: int = 192
    hippocampus_capacity: int = 400
    dmn_replay_rate: float = 0.10
    knowledge_enabled: bool = True
    association_prob_base: float = 0.06
    association_prob_idle: float = 0.18
    association_temperature: float = 2.0

    def to_public(self) -> dict:
        return {**asdict(self)}

    @classmethod
    def from_env(cls) -> "BrainConfig":
        mode = os.getenv("BRAIN_MODE", "einstein").strip().lower()
        if mode not in ("default", "einstein"):
            mode = "einstein"
        if mode == "einstein":
            cfg = cls(
                mode="einstein",
                pfc_hidden=192,
                hippocampus_capacity=400,
                dmn_replay_rate=0.10,
                knowledge_enabled=True,
                association_prob_base=0.06,
                association_prob_idle=0.18,
                association_temperature=2.0,
            )
        else:
            cfg = cls(
                mode="default",
                pfc_hidden=96,
                hippocampus_capacity=200,
                dmn_replay_rate=0.05,
                knowledge_enabled=False,
                association_prob_base=0.02,
                association_prob_idle=0.06,
                association_temperature=1.5,
            )
        override = os.getenv("BRAIN_KNOWLEDGE")
        if override is not None:
            cfg.knowledge_enabled = override.strip().lower() in ("1", "true", "yes", "on")
        return cfg
