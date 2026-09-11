"""The Brain — orchestrates every region.

A single ``step(observation)`` call runs the full perception → memory →
emotion → decision → action pipeline, and returns:

  * the chosen action
  * a snapshot of the whole brain (streamed to the frontend)
  * a stream of human-readable "thoughts" describing what just happened

Nothing here uses an LLM. Every 'thought' is generated from the actual
computations happening inside the regions.

Two extras compared to a bare RL agent:

* At boot the hippocampus is (optionally) seeded with ~60 permanent
  **knowledge memories** — crypto and Einstein concepts (see
  ``backend/knowledge.py``). During thinking the brain occasionally
  *associates* to one of these and it surfaces in the thought stream.
* An **"Einstein mode"** preset (default) enlarges the PFC, extends the
  hippocampus capacity, and makes the default-mode network more active.
"""

from __future__ import annotations

import random
import time
from collections import deque
from typing import Deque, Dict, List, Optional

import torch
import torch.nn.functional as F

from .config import BrainConfig
from .regions import (
    Amygdala,
    DefaultModeNetwork,
    Hippocampus,
    MotorCortex,
    NucleusAccumbens,
    PrefrontalCortex,
    Thalamus,
    TraderCortex,
    VisualCortex,
    ACTION_NAMES,
    ACTION_NAMES_ZH,
)
from ..knowledge import all_concepts_with_embeddings
from ..market import MARKET_FEATURE_DIM


FEATURE_DIM = 32
NUM_ACTIONS = 5


class Thought:
    """One entry in the brain's stream of consciousness."""

    def __init__(self, step: int, region: str, text: str, text_zh: str,
                 kind: str = "info", extra: Optional[dict] = None):
        self.step = step
        self.region = region
        self.text = text
        self.text_zh = text_zh
        self.kind = kind  # info | plan | recall | emotion | reward | action | associate
        self.time = time.time()
        self.extra = extra or {}

    def to_dict(self) -> dict:
        return {
            "step": self.step,
            "region": self.region,
            "text": self.text,
            "text_zh": self.text_zh,
            "kind": self.kind,
            "time": self.time,
            "extra": self.extra,
        }


class Brain:
    def __init__(self,
                 num_actions: int = NUM_ACTIONS,
                 config: Optional[BrainConfig] = None):
        self.config = config or BrainConfig.from_env()
        feature_dim = self.config.feature_dim

        # --- Cortical & subcortical modules ---
        self.visual_cortex = VisualCortex(feature_dim=feature_dim)
        self.thalamus = Thalamus(feature_dim=feature_dim)
        self.hippocampus = Hippocampus(
            feature_dim=feature_dim,
            capacity=self.config.hippocampus_capacity,
        )
        self.amygdala = Amygdala(feature_dim=feature_dim)
        self.nucleus_accumbens = NucleusAccumbens()
        # Thought vector = visual (32) + recalled memory (32) + fear (1) + reward-baseline (1)
        self.prefrontal_cortex = PrefrontalCortex(
            input_dim=feature_dim * 2 + 2,
            num_actions=num_actions,
            hidden=self.config.pfc_hidden,
        )
        self.motor_cortex = MotorCortex(num_actions=num_actions)
        self.default_mode = DefaultModeNetwork(
            replay_rate=self.config.dmn_replay_rate,
        )
        self.trader_cortex = TraderCortex(market_feature_dim=MARKET_FEATURE_DIM,
                                           hidden=96)

        self.regions: List = [
            self.visual_cortex,
            self.thalamus,
            self.hippocampus,
            self.amygdala,
            self.nucleus_accumbens,
            self.prefrontal_cortex,
            self.motor_cortex,
            self.default_mode,
            self.trader_cortex,
        ]

        # Running state used for online learning.
        self.step_count: int = 0
        self._last_log_prob: Optional[torch.Tensor] = None
        self._last_value: Optional[torch.Tensor] = None
        self._last_thought_vec: Optional[torch.Tensor] = None
        self._last_position: tuple = (0, 0)
        self._last_visual: Optional[torch.Tensor] = None

        self.thoughts: Deque[Thought] = deque(maxlen=120)
        self.engagement: float = 0.5  # 0=idle, 1=very engaged

        # Which concept id is currently 'lit up' (for UI). Decays over time.
        self.active_concept: Optional[dict] = None
        self._concept_lit_until_step: int = -1

        # --- Seed permanent knowledge memories ---
        self._concepts_by_id: Dict[str, "Concept"] = {}
        if self.config.knowledge_enabled:
            for concept, emb in all_concepts_with_embeddings(dim=feature_dim):
                self.hippocampus.store_knowledge(
                    features=emb, label=concept.id, category=concept.category,
                )
                self._concepts_by_id[concept.id] = concept

    # ------------------------------------------------------------------

    def _add_thought(self, region: str, text: str, text_zh: str,
                     kind: str = "info", extra: Optional[dict] = None):
        self.thoughts.append(Thought(
            self.step_count, region, text, text_zh, kind, extra=extra,
        ))

    def step(self, observation: dict) -> Dict:
        """Run one perception→action cycle.

        Expects observation = {
            'image': torch.FloatTensor (3, H, W),
            'danger': float in [0, 1] — proximity to danger
            'reward': float — reward received on the PREVIOUS action
            'position': (x, y) — agent's current cell (for memory context)
            'done': bool — episode terminated on last action
        }
        """
        self.step_count += 1
        image = observation["image"]
        danger = float(observation.get("danger", 0.0))
        reward = float(observation.get("reward", 0.0))
        position = tuple(observation.get("position", (0, 0)))
        done = bool(observation.get("done", False))

        # ---- 1. Reward / motivation update from LAST action ----
        pred_error = self.nucleus_accumbens.perceive(reward)
        if reward > 0.5:
            self._add_thought("nucleus_accumbens",
                              f"Reward received ({reward:+.1f}). Prediction error {pred_error:+.2f}.",
                              f"获得奖励 {reward:+.1f}，预测误差 {pred_error:+.2f}。",
                              kind="reward")
        elif reward < -0.5:
            self._add_thought("nucleus_accumbens",
                              f"Punishment received ({reward:+.1f}).",
                              f"受到惩罚 {reward:+.1f}。",
                              kind="reward")
            self.amygdala.condition(reward)

        # ---- 2. Online learning from previous decision ----
        loss = None
        if (self._last_log_prob is not None and self._last_value is not None
                and not done):
            with torch.no_grad():
                _, next_val, _ = self.prefrontal_cortex.forward(
                    self._build_thought_vector_preview(image, danger, reward)
                )
                next_val = float(next_val.item())
            loss = self.prefrontal_cortex.learn(
                self._last_log_prob, self._last_value, reward, next_val
            )

        # ---- 3. Perception: visual cortex → thalamus ----
        visual = self.visual_cortex.forward(image)
        gated_visual = self.thalamus.gate(visual, self.amygdala.fear, self.engagement)

        # ---- 4. Emotion: amygdala reads danger + learned associations ----
        fear = self.amygdala.perceive(gated_visual, danger, self.step_count)
        if fear > 0.7:
            self._add_thought("amygdala",
                              f"High fear ({fear:.2f}) — bias toward escape.",
                              f"高度恐惧 ({fear:.2f})，倾向逃避。",
                              kind="emotion")

        # ---- 5. Memory: hippocampus recalls similar past experience ----
        recalled = self.hippocampus.recall(gated_visual)
        if (recalled is not None
                and recalled.tag == "episode"
                and self.hippocampus.last_similarity > 0.75):
            if recalled.valence > 0.3:
                self._add_thought("hippocampus",
                                  "I've been somewhere like this — it was good.",
                                  "这地方我似曾相识——上次是好的。",
                                  kind="recall")
            elif recalled.valence < -0.3:
                self._add_thought("hippocampus",
                                  "I remember this — it hurt.",
                                  "这地方我记得——上次受伤了。",
                                  kind="recall")

        # ---- 6. Build the unified 'thought vector' ----
        recall_features = recalled.features if recalled is not None else torch.zeros(FEATURE_DIM)
        thought_vec = torch.cat([
            gated_visual,
            recall_features,
            torch.tensor([fear], dtype=torch.float32),
            torch.tensor([self.nucleus_accumbens.baseline], dtype=torch.float32),
        ])
        self._last_thought_vec = thought_vec

        # ---- 7. Decision: prefrontal cortex ----
        logits, value, hidden = self.prefrontal_cortex.forward(thought_vec)

        if fear > 0.6:
            logits = logits.clone()
            logits[4] -= 1.5  # discourage freezing when scared

        # ---- 8. Motor: sample action ----
        action, log_prob, probs = self.motor_cortex.act(logits)
        self._last_log_prob = log_prob
        self._last_value = value

        self._add_thought("prefrontal_cortex",
                          f"Considering options: {[round(p, 2) for p in probs.tolist()]} → chose {ACTION_NAMES[action]} (conf {self.motor_cortex.last_confidence:.2f}).",
                          f"权衡选项：{[round(p, 2) for p in probs.tolist()]} → 选择{ACTION_NAMES_ZH[action]}（置信度 {self.motor_cortex.last_confidence:.2f}）。",
                          kind="plan")
        self._add_thought("motor_cortex",
                          f"Motor command: {ACTION_NAMES[action]}.",
                          f"运动指令：{ACTION_NAMES_ZH[action]}。",
                          kind="action")

        # ---- 9. Store this moment in episodic memory ----
        valence = float(torch.tanh(value.detach()).item())
        self.hippocampus.store(gated_visual, valence=valence, fear=fear,
                               location=position, step=self.step_count)

        # ---- 10. DMN ticks (may replay a memory in the background) ----
        self.engagement = min(1.0, abs(pred_error) * 1.5 + fear * 0.5 + 0.15)
        replayed = self.default_mode.tick(self.engagement, self.hippocampus, self.step_count)
        if replayed is not None:
            self._add_thought("default_mode",
                              "Background: idly replaying a past scene.",
                              "后台：随机回放一段过去的经历。",
                              kind="info")

        # ---- 11. Knowledge association (Einstein-mode 'thinking off-topic') ----
        self._maybe_associate_knowledge(gated_visual)

        # Decay concept lighting.
        if self.active_concept and self.step_count > self._concept_lit_until_step:
            self.active_concept = None

        self._last_position = position
        self._last_visual = gated_visual.detach()

        return {
            "action": action,
            "action_label": ACTION_NAMES[action],
            "action_label_zh": ACTION_NAMES_ZH[action],
            "loss": loss,
        }

    # ------------------------------------------------------------------

    def _maybe_associate_knowledge(self, cue: torch.Tensor) -> None:
        """With small probability, sample a knowledge concept and 'think about it'."""
        if not (self.config.knowledge_enabled and self.hippocampus.knowledge):
            return
        idle = 1.0 - min(1.0, self.engagement)
        prob = self.config.association_prob_base + self.config.association_prob_idle * idle
        if random.random() >= prob:
            return
        assoc = self.hippocampus.associate_knowledge(
            cue, temperature=self.config.association_temperature,
        )
        if assoc is None:
            return
        ep, sim = assoc
        concept = self._concepts_by_id.get(ep.label)
        if concept is None:
            return
        self.active_concept = {
            "id": concept.id,
            "category": concept.category,
            "zh": concept.zh,
            "en": concept.en,
            "desc_zh": concept.desc_zh,
            "desc_en": concept.desc_en,
            "similarity": round(float(sim), 3),
        }
        # Concept stays 'lit' for ~4 steps so the frontend has time to show it.
        self._concept_lit_until_step = self.step_count + 4
        self._add_thought(
            "prefrontal_cortex",
            f"💭 associates with {concept.en} — {concept.desc_en[:80]}",
            f"💭 联想到「{concept.zh}」——{concept.desc_zh[:40]}",
            kind="associate",
            extra={"concept_id": concept.id, "category": concept.category,
                   "similarity": round(float(sim), 3)},
        )

    def _build_thought_vector_preview(self, image, danger, reward):
        """Cheap approximate 'next-state' thought vector for bootstrapping the
        value target. We don't run the full memory recall here.
        """
        with torch.no_grad():
            v = self.visual_cortex.forward(image)
            gv = self.thalamus.gate(v, self.amygdala.fear, self.engagement)
            fake_mem = self._last_visual if self._last_visual is not None else torch.zeros(FEATURE_DIM)
            return torch.cat([
                gv,
                fake_mem,
                torch.tensor([self.amygdala.fear], dtype=torch.float32),
                torch.tensor([self.nucleus_accumbens.baseline], dtype=torch.float32),
            ])

    def snapshot(self) -> dict:
        """Everything the UI needs about the current brain state."""
        return {
            "step": self.step_count,
            "engagement": round(self.engagement, 3),
            "mode": self.config.mode,
            "config": self.config.to_public(),
            "regions": [r.state() for r in self.regions],
            "thoughts": [t.to_dict() for t in self.thoughts],
            "hippocampus_stats": self.hippocampus.stats(),
            "amygdala_stats": self.amygdala.stats(),
            "reward_stats": self.nucleus_accumbens.stats(),
            "motor_stats": self.motor_cortex.stats(),
            "active_concept": self.active_concept,
        }
