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

import os
import random
import time
from collections import deque
from typing import Deque, Dict, List, Optional

import torch
import torch.nn.functional as F

from .config import BrainConfig
from .regions import (
    Amygdala,
    CentralComplex,
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
from ..knowledge import (
    CATEGORIES as KNOWLEDGE_CATEGORIES,
    all_concepts_with_embeddings,
    concept_embedding_for_text,
)
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
        # A real spiking sub-brain: fly-central-complex-style LIF ring
        # attractor. It runs alongside the deep-learning cortex, driven by
        # the motor cortex's last action, and produces a heading bump the
        # rest of the brain can read as a 4-D feature vector.
        self.central_complex = CentralComplex()

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
            self.central_complex,
        ]

        # Running state used for online learning.
        self.step_count: int = 0
        # Lifetime step count — sum across ALL machine boots. This is what
        # tells the user "the brain has been continuously learning for X
        # ticks since first boot" and is a hard proof it was never wiped.
        # step_count is per-process; lifetime_step_count is per-brain.
        self.lifetime_step_count: int = 0
        # When this brain was first created, in unix seconds. Loaded from
        # disk on restart so it reflects true age of learned state, not
        # process age.
        self.first_boot_at_s: float = time.time()
        # When this specific process (VM boot) started. Never persisted —
        # gives us "uptime this boot" for the UI.
        self.process_started_at_s: float = time.time()
        # Cumulative wall-clock time this brain has been running (across
        # all machine boots). Updated on save + on load. Different from
        # (now - first_boot_at_s) because the machine can be down briefly
        # during a rolling deploy.
        self.lifetime_uptime_s: float = 0.0
        # Count of process boots so far (across the brain's lifetime).
        self.boot_count: int = 1
        self._last_log_prob: Optional[torch.Tensor] = None
        self._last_value: Optional[torch.Tensor] = None
        self._last_thought_vec: Optional[torch.Tensor] = None
        self._last_position: tuple = (0, 0)
        self._last_visual: Optional[torch.Tensor] = None

        # Throttling state for the thought stream so we don't spam the UI
        # with identical PFC/motor lines every tick when the brain is stuck
        # committing to the same action.
        self._last_reported_action: Optional[int] = None
        self._last_reported_confidence: float = -1.0
        self._same_action_streak: int = 0

        self.thoughts: Deque[Thought] = deque(maxlen=120)
        self.engagement: float = 0.5  # 0=idle, 1=very engaged

        # Which concept id is currently 'lit up' (for UI). Decays over time.
        self.active_concept: Optional[dict] = None
        self._concept_lit_until_step: int = -1

        # --- Seed permanent knowledge memories ---
        # `_concepts_by_id` covers BOTH seed and learned concepts so the
        # associate-thought code can look up either kind uniformly. The
        # seed set is regenerated deterministically every boot; the
        # learned set is loaded from disk (see load_state_dict_safe).
        self._concepts_by_id: Dict[str, "Concept"] = {}
        # Learned concepts the brain has added at runtime. Each dict has
        # {id, category, zh, en, desc_zh, desc_en, learned_at_step}.
        # Persisted separately from seed concepts.
        self.learned_concepts: List[dict] = []
        # Cap so the knowledge bank doesn't explode after months of running.
        self.max_learned_concepts = 400
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

    # ------------------------------------------------------------------
    # Runtime knowledge growth
    # ------------------------------------------------------------------
    def learn_concept(self, *, concept_id: str, category: str,
                      zh: str, en: str,
                      desc_zh: str = "", desc_en: str = "",
                      quiet: bool = False) -> bool:
        """Add a new permanent knowledge concept the brain has just
        encountered in the wild (a fresh token, a new market pattern,
        an event it wants to remember).

        Idempotent — if ``concept_id`` is already known (seed OR learned)
        this is a no-op. Emits a "learn" thought unless ``quiet=True``.

        Returns True if a new concept was added, False otherwise.
        """
        if not concept_id or concept_id in self._concepts_by_id:
            return False
        if category not in KNOWLEDGE_CATEGORIES:
            category = "learned_pattern"

        emb = concept_embedding_for_text(concept_id, category=category,
                                         dim=self.config.feature_dim)
        self.hippocampus.store_knowledge(
            features=emb, label=concept_id, category=category,
        )

        # Register a lightweight Concept-shaped object so the rest of
        # the brain (associate thoughts, snapshot) can treat it like a
        # seed. We avoid importing Concept here to keep this module
        # standalone; a SimpleNamespace works equivalently.
        from types import SimpleNamespace
        c = SimpleNamespace(
            id=concept_id, category=category,
            zh=zh or concept_id, en=en or concept_id,
            desc_zh=desc_zh, desc_en=desc_en,
        )
        self._concepts_by_id[concept_id] = c

        # Persist the learned concept so it survives restarts.
        self.learned_concepts.append({
            "id": concept_id,
            "category": category,
            "zh": c.zh,
            "en": c.en,
            "desc_zh": desc_zh,
            "desc_en": desc_en,
            "learned_at_step": self.lifetime_step_count,
            "learned_at_s": time.time(),
        })
        if len(self.learned_concepts) > self.max_learned_concepts:
            # FIFO evict oldest learned entries so the bank stays bounded.
            drop = self.learned_concepts[:len(self.learned_concepts) - self.max_learned_concepts]
            self.learned_concepts = self.learned_concepts[-self.max_learned_concepts:]
            drop_ids = {d["id"] for d in drop}
            # Also drop from _concepts_by_id and hippocampus.
            for dropped_id in drop_ids:
                self._concepts_by_id.pop(dropped_id, None)
            self.hippocampus.knowledge = [
                ep for ep in self.hippocampus.knowledge
                if ep.label not in drop_ids
            ]

        if not quiet:
            snippet_en = (desc_en or en or concept_id)[:80]
            snippet_zh = (desc_zh or zh or concept_id)[:40]
            self._add_thought(
                "hippocampus",
                f"learned: {en} — {snippet_en}",
                f"新学到：「{zh}」——{snippet_zh}",
                kind="learn",
                extra={"concept_id": concept_id, "category": category},
            )
        return True

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
        self.lifetime_step_count += 1
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

        confidence = float(self.motor_cortex.last_confidence)
        action_changed = action != self._last_reported_action
        conf_delta = abs(confidence - self._last_reported_confidence)
        if action_changed:
            self._same_action_streak = 1
        else:
            self._same_action_streak += 1

        # PFC "plan" thought — only when the decision meaningfully changes
        # (new action or ≥20% jump in confidence), OR every 30 ticks (~5s)
        # so we still emit a heartbeat when the brain is committing.
        if action_changed or conf_delta >= 0.20 or self._same_action_streak % 30 == 0:
            intent_en, intent_zh = self._describe_intent(action, probs)
            if action_changed and self._last_reported_action is not None:
                prev_en = ACTION_NAMES[self._last_reported_action]
                prev_zh = ACTION_NAMES_ZH[self._last_reported_action]
                prefix_en = f"switched from {prev_en} → "
                prefix_zh = f"从「{prev_zh}」切换 → "
            elif not action_changed and self._same_action_streak >= 30:
                secs = self._same_action_streak // 6  # brain runs ~6Hz
                prefix_en = f"still committing after {secs}s — "
                prefix_zh = f"已坚持 {secs} 秒 — "
            else:
                prefix_en = ""
                prefix_zh = ""
            self._add_thought(
                "prefrontal_cortex",
                f"{prefix_en}{intent_en}",
                f"{prefix_zh}{intent_zh}",
                kind="plan",
            )

        # Motor "action" thought — only when the action itself flips.
        if action_changed:
            self._add_thought(
                "motor_cortex",
                f"Motor command → {ACTION_NAMES[action]}.",
                f"运动指令 → {ACTION_NAMES_ZH[action]}。",
                kind="action",
            )
            self._last_reported_action = action
            self._last_reported_confidence = confidence
        elif conf_delta >= 0.20:
            self._last_reported_confidence = confidence

        # ---- 8b. Central complex: advance the spiking ring-attractor ----
        # The bump is our heading compass. It shifts based on the motor
        # action we just chose, running as real LIF neurons wired to the
        # published fly central complex topology.
        cc_feats = self.central_complex.tick(motor_action=action,
                                             drive_strength=self.motor_cortex.last_confidence)
        if cc_feats["bump_amplitude"] > 0.55 and self.step_count % 12 == 0:
            self._add_thought(
                "central_complex",
                f"Heading bump @ {self.central_complex.stats()['compass']} "
                f"(amp {cc_feats['bump_amplitude']:.2f}, {cc_feats['pop_rate_hz']:.0f} Hz).",
                f"朝向 bump 指向 {self.central_complex.stats()['compass']}"
                f"（amp {cc_feats['bump_amplitude']:.2f}，{cc_feats['pop_rate_hz']:.0f} Hz）。",
                kind="info",
            )

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

    def _describe_intent(self, action: int, probs: torch.Tensor) -> tuple:
        """Turn the raw softmax over 5 actions into readable EN/ZH text.

        We used to dump the full 5-vector as `[0.0, 1.0, 0.0, 0.0, 0.0]`
        which looks like garbage in the UI, especially when the brain is
        stuck on one action. Now we return e.g.
            'decisively picks move down (100%)'
            'leans toward move down (68%)'
            'torn between move down (52%) and move right (44%)'
            'weighing all options'
        """
        p_list = [float(x) for x in probs.tolist()]
        chosen_p = p_list[action]
        # Second-most-likely alternative
        alt_action = max(
            (i for i in range(len(p_list)) if i != action),
            key=lambda i: p_list[i],
        )
        alt_p = p_list[alt_action]

        chosen_en = ACTION_NAMES[action]
        chosen_zh = ACTION_NAMES_ZH[action]
        alt_en = ACTION_NAMES[alt_action]
        alt_zh = ACTION_NAMES_ZH[alt_action]

        if chosen_p >= 0.85:
            return (
                f"decisively picks {chosen_en} ({chosen_p * 100:.0f}%)",
                f"果断选择「{chosen_zh}」（{chosen_p * 100:.0f}%）",
            )
        if chosen_p >= 0.5:
            return (
                f"leans toward {chosen_en} ({chosen_p * 100:.0f}%)",
                f"倾向「{chosen_zh}」（{chosen_p * 100:.0f}%）",
            )
        if chosen_p >= 0.35:
            return (
                f"torn between {chosen_en} ({chosen_p * 100:.0f}%) and "
                f"{alt_en} ({alt_p * 100:.0f}%)",
                f"在「{chosen_zh}」（{chosen_p * 100:.0f}%）和"
                f"「{alt_zh}」（{alt_p * 100:.0f}%）之间犹豫",
            )
        return (
            f"weighing all options — tentatively {chosen_en}",
            f"权衡所有选项——暂选「{chosen_zh}」",
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
        now = time.time()
        proc_uptime = max(0.0, now - self.process_started_at_s)
        # Live lifetime uptime = persisted + this process's uptime so far.
        live_lifetime = self.lifetime_uptime_s + proc_uptime
        return {
            "step": self.step_count,
            "lifetime_step": self.lifetime_step_count,
            "boot_count": self.boot_count,
            "first_boot_at_s": self.first_boot_at_s,
            "process_started_at_s": self.process_started_at_s,
            "process_uptime_s": round(proc_uptime, 1),
            "lifetime_uptime_s": round(live_lifetime, 1),
            "engagement": round(self.engagement, 3),
            "mode": self.config.mode,
            "config": self.config.to_public(),
            "regions": [r.state() for r in self.regions],
            "thoughts": [t.to_dict() for t in self.thoughts],
            "hippocampus_stats": self.hippocampus.stats(),
            "amygdala_stats": self.amygdala.stats(),
            "reward_stats": self.nucleus_accumbens.stats(),
            "motor_stats": self.motor_cortex.stats(),
            "central_complex_stats": self.central_complex.stats(),
            "active_concept": self.active_concept,
            "learned_concepts_count": len(self.learned_concepts),
            "learned_concepts": [
                {**c, "category_meta": KNOWLEDGE_CATEGORIES.get(c["category"], {}),
                 "learned": True}
                for c in self.learned_concepts[-80:]
            ],
        }

    # ------------------------------------------------------------------
    # Full-brain persistence
    # ------------------------------------------------------------------

    def state_dict_serializable(self) -> dict:
        """Everything worth saving for a warm restart.

        We deliberately DO NOT save the ephemeral central-complex
        neuron voltages or DMN transient state — they re-initialise in a
        fraction of a second. Everything that took real learning to build
        (PFC actor-critic weights, hippocampal episodes, amygdala fear
        templates, NAcc baseline, and lifetime counters) IS saved so the
        brain resumes exactly where it left off.
        """
        now = time.time()
        proc_uptime = max(0.0, now - self.process_started_at_s)
        return {
            "version": 2,
            "step_count": self.step_count,
            "lifetime_step_count": self.lifetime_step_count,
            "first_boot_at_s": self.first_boot_at_s,
            "boot_count": self.boot_count,
            "lifetime_uptime_s": self.lifetime_uptime_s + proc_uptime,
            "engagement": self.engagement,
            "prefrontal_cortex": self.prefrontal_cortex.state_dict_serializable(),
            "hippocampus": self.hippocampus.state_dict_serializable(),
            "amygdala": self.amygdala.state_dict_serializable(),
            "nucleus_accumbens": self.nucleus_accumbens.state_dict_serializable(),
            "learned_concepts": list(self.learned_concepts),
        }

    def load_state_dict_safe(self, sd: dict) -> None:
        """Restore a previously-saved brain. All fields are best-effort:
        anything malformed is silently skipped so we never fail a boot on
        a stale/corrupt state file."""
        try:
            self.lifetime_step_count = int(sd.get("lifetime_step_count", 0))
            self.first_boot_at_s = float(sd.get("first_boot_at_s", self.first_boot_at_s))
            self.boot_count = int(sd.get("boot_count", 1)) + 1
            self.lifetime_uptime_s = float(sd.get("lifetime_uptime_s", 0.0))
            self.engagement = float(sd.get("engagement", self.engagement))
            if "prefrontal_cortex" in sd:
                self.prefrontal_cortex.load_state_dict_safe(sd["prefrontal_cortex"])
            if "hippocampus" in sd:
                self.hippocampus.load_state_dict_safe(sd["hippocampus"])
            if "amygdala" in sd:
                self.amygdala.load_state_dict_safe(sd["amygdala"])
            if "nucleus_accumbens" in sd:
                self.nucleus_accumbens.load_state_dict_safe(sd["nucleus_accumbens"])
            # Restore learned concepts (added at runtime, e.g. fresh tokens
            # the brain has seen). Each entry becomes a permanent knowledge
            # memory again so associations continue to work.
            self.learned_concepts = []
            for entry in sd.get("learned_concepts", []) or []:
                if not isinstance(entry, dict):
                    continue
                cid = entry.get("id")
                if not cid or cid in self._concepts_by_id:
                    continue
                self.learn_concept(
                    concept_id=cid,
                    category=entry.get("category", "learned_pattern"),
                    zh=entry.get("zh", cid),
                    en=entry.get("en", cid),
                    desc_zh=entry.get("desc_zh", ""),
                    desc_en=entry.get("desc_en", ""),
                    quiet=True,
                )
                # Preserve the original learned_at_step/s if provided.
                if self.learned_concepts and self.learned_concepts[-1]["id"] == cid:
                    if "learned_at_step" in entry:
                        self.learned_concepts[-1]["learned_at_step"] = int(entry["learned_at_step"])
                    if "learned_at_s" in entry:
                        self.learned_concepts[-1]["learned_at_s"] = float(entry["learned_at_s"])
        except Exception:  # noqa: BLE001
            pass
