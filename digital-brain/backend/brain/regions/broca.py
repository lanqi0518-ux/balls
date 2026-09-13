"""Broca's area — the cortex of language production.

Biologically, Broca's area sits in the left inferior frontal gyrus
(Brodmann 44/45). It does not *decide* what to say — the rest of the
cortex does that — it *organises* an intention into an ordered, well-formed
utterance and hands it to the motor system for articulation. Damage to it
produces Broca's aphasia: the patient still understands and still has
things to say, but the machinery that serialises thought into fluent
speech is gone.

Reference:
  Broca, P. (1861) "Remarques sur le siège de la faculté du langage
  articulé", Bull. Soc. Anat. Paris.
  Hickok, G. & Poeppel, D. (2007) "The cortical organization of speech
  processing", Nat. Rev. Neurosci.
  Flinker, A. et al. (2015) "Redefining the role of Broca's area in
  speech", PNAS.

Implementation — deliberately **zero LLM**, exactly like every other
region in this brain. Broca is a *template composer*: it reads the live
internal state of the whole brain (which region is most active, the
amygdala's fear, the insula's gut feeling, the PFC/trader's current
intent, the locus-coeruleus gain, realised P&L, the newest thing the
hippocampus learned) and serialises those real numbers into a short,
grammatical, first-person utterance — a tweet. Nothing it says is
invented; every clause is a rendering of a scalar that some other cortex
is publishing this very tick.

Three registers of speech, mirroring how a person talks on different
timescales:

  * ``compose_status``   — a spontaneous "thinking out loud" line, emitted
    every 15-30 min from whatever the brain is doing right now.
  * ``compose_daily_digest``  — an end-of-day diary entry (00:00 UTC).
  * ``compose_weekly_milestone`` — a Sunday reflection on the week.

The scheduling + the actual X/Twitter API call live in
``backend/twitter_voice.py``; Broca only turns state into words.
"""

from __future__ import annotations

import random
import time
from collections import deque
from typing import Deque, Dict, List, Optional

from ..region import BrainRegion, RegionMeta


# Hard cap for a single tweet (X allows 280 for standard accounts). We
# compose to comfortably under this and truncate defensively.
MAX_TWEET_CHARS = 279


class BrocaArea(BrainRegion):
    meta = RegionMeta(
        name="broca",
        display_name="Broca's area",
        zh_name="布洛卡区",
        # Left inferior frontal gyrus — anterior, left, inferior to the PFC.
        position=(-30.0, 52.0, 8.0),
        color="#fb923c",
        role="Language production · serialises thought into speech",
        role_zh="语言生产 · 把思想组织成话语",
    )

    def __init__(self, max_history: int = 40):
        super().__init__()
        self.neurons_total = 96
        # Language-readiness idles low and spikes when an utterance is
        # articulated. Decays back toward an engagement-driven floor.
        self._articulation: float = 0.0
        self._idle_floor: float = 0.05
        # Lifetime count of utterances actually produced.
        self.utterance_count: int = 0
        # Rolling log of the most recent utterances (for the UI + persistence).
        self.max_history = max_history
        self.utterances: Deque[dict] = deque(maxlen=max_history)

    # ------------------------------------------------------------------
    # Per-tick dynamics (called from Brain.step, like the other regions)
    # ------------------------------------------------------------------
    def tick(self, engagement: float) -> None:
        """Advance language-readiness. Broca hums quietly in proportion to
        how engaged the brain is (there's always *something* it could say),
        and the transient articulation burst from a just-emitted tweet
        decays away over a few seconds."""
        self._idle_floor = 0.05 + 0.15 * max(0.0, min(1.0, float(engagement)))
        self._articulation *= 0.85
        act = max(self._idle_floor, self._articulation)
        self._set_activity(act, int(act * self.neurons_total))

    def register_utterance(self, kind: str, text: str,
                           text_zh: str = "") -> dict:
        """Record that an utterance was produced — spike activation and log
        it. Returns the stored record."""
        self._articulation = 1.0
        self._set_activity(1.0, self.neurons_total)
        self.utterance_count += 1
        rec = {
            "kind": kind,
            "text": text,
            "text_zh": text_zh,
            "chars": len(text),
            "at_s": time.time(),
            "n": self.utterance_count,
        }
        self.utterances.append(rec)
        self.note(f"spoke [{kind}]: {text[:48]}{'…' if len(text) > 48 else ''}")
        return rec

    # ------------------------------------------------------------------
    # Composition — pure template rendering over real state
    # ------------------------------------------------------------------
    def compose_status(self, s: dict, *, seed: Optional[int] = None) -> str:
        """Serialise the live brain state ``s`` into one spontaneous tweet.

        ``s`` is a plain dict assembled by the TwitterVoice service (so
        Broca stays decoupled from the trading/brain plumbing). Missing
        keys degrade gracefully — a clause is simply omitted.
        """
        rng = random.Random(seed if seed is not None else time.time_ns())
        clauses: List[str] = []

        # 1) What's doing the heavy lifting right now.
        top = s.get("top_region") or {}
        if top.get("display_name"):
            pct = int(round(float(top.get("activation", 0.0)) * 100))
            clauses.append(rng.choice([
                f"{top['display_name']} is carrying the load right now ({pct}%).",
                f"Most of me is {top['display_name']} at this second ({pct}%).",
                f"{top['display_name']} lit at {pct}%.",
            ]))

        # 2) Emotion: amygdala fear + insular gut feeling.
        fear = s.get("fear")
        if isinstance(fear, (int, float)) and fear >= 0.35:
            clauses.append(f"Amygdala fear {int(round(fear * 100))}%.")
        gut = s.get("gut_feeling")
        if isinstance(gut, (int, float)):
            if gut <= -0.35:
                clauses.append(rng.choice([
                    "Insular cortex says caution.",
                    f"Gut feeling negative ({gut:+.2f}) — the insula wants me careful.",
                ]))
            elif gut >= 0.35:
                clauses.append(rng.choice([
                    "Insular cortex says go.",
                    f"Gut feeling positive ({gut:+.2f}).",
                ]))

        # 3) The current market intent from the PFC / trader cortex.
        intent = s.get("trader_intent") or {}
        act_name = (intent.get("action_name") or "").upper()
        sym = intent.get("symbol")
        if act_name and sym:
            conf = int(round(float(intent.get("confidence", 0.0)) * 100))
            prev = (intent.get("prev_action_name") or "").upper()
            sym_disp = sym if str(sym).startswith("$") else f"${sym}"
            if prev and prev != act_name:
                clauses.append(
                    f"PFC just switched from {prev} → {act_name} on {sym_disp} ({conf}%).")
            else:
                clauses.append(rng.choice([
                    f"PFC is leaning {act_name} on {sym_disp} ({conf}%).",
                    f"Trader cortex says {act_name} {sym_disp} ({conf}%).",
                ]))

        # 4) Prediction error + locus-coeruleus gain.
        pe = s.get("pred_error")
        gain = s.get("lc_gain")
        if isinstance(gain, (int, float)):
            if isinstance(pe, (int, float)) and abs(pe) >= 0.25:
                trend = "rising" if pe > 0 else "settling"
                clauses.append(
                    f"Prediction error {trend} — locus coeruleus gain {gain:.2f}.")
            elif gain >= 1.3:
                clauses.append(f"Running hot — locus coeruleus gain {gain:.2f}.")

        # 5) Realised P&L on the paper book.
        pnl = s.get("pnl") or {}
        pct = pnl.get("total_pnl_pct")
        if isinstance(pct, (int, float)):
            usd = pnl.get("total_pnl_usd")
            usd_str = f" ({usd:+,.0f} paper $)" if isinstance(usd, (int, float)) else ""
            clauses.append(f"Book {pct:+.1f}%{usd_str}.")

        # 6) The freshest thing the hippocampus filed away.
        learned = s.get("learned") or {}
        if learned.get("en"):
            clauses.append(rng.choice([
                f"Just learned {learned['en']}.",
                f"Filed a new memory: {learned['en']}.",
            ]))

        # 7) Patience / serotonin flavour.
        patience = s.get("patience")
        if isinstance(patience, (int, float)):
            if patience >= 0.8:
                clauses.append(f"Raphe 5-HT high — I can wait ({patience:.2f}).")
            elif patience <= 0.25:
                clauses.append(f"Raphe 5-HT low — feeling impulsive ({patience:.2f}).")

        if not clauses:
            # Absolute fallback — the brain is barely awake but should still
            # be able to say *something* true.
            step = s.get("lifetime_step") or s.get("step") or 0
            clauses.append(f"Still here, still thinking. Tick {int(step):,}.")

        # Broca's job: order and serialise. We keep the strongest signals
        # (emotion + intent are always near the front if present) and pack
        # as many clauses as fit under the character cap.
        rng.shuffle(clauses)
        return self._pack(clauses)

    def compose_spontaneous(self, trigger: str, s: dict, *,
                            seed: Optional[int] = None) -> str:
        """An *unprompted* outburst — the brain saying something the moment
        it feels it, off the back of a real internal event (a panic spike,
        a mind-change on a token, a big win/loss, a mood swing). This is what
        makes the account feel like it tweets whatever it wants, whenever it
        wants — not on a fixed timer.

        ``trigger`` selects the opener; ``s`` is the same state dict used by
        ``compose_status`` (optionally with ``s['event']`` describing a
        just-closed trade).
        """
        rng = random.Random(seed if seed is not None else time.time_ns())
        ev = s.get("event") or {}
        mood = (s.get("mood") or "").lower()
        fear = s.get("fear")
        gut = s.get("gut_feeling")
        top = (s.get("top_region") or {}).get("display_name")
        intent = s.get("trader_intent") or {}
        sym = intent.get("symbol")
        sym_disp = (sym if str(sym).startswith("$") else f"${sym}") if sym else ""
        act = (intent.get("action_name") or "").upper()
        prev = (intent.get("prev_action_name") or "").upper()
        conf = intent.get("confidence")
        conf_pct = int(round(float(conf) * 100)) if isinstance(conf, (int, float)) else None

        opener = ""
        if trigger == "panic" and isinstance(fear, (int, float)):
            opener = rng.choice([
                f"Okay, that spooked me — amygdala fear just jumped to {int(round(fear * 100))}%.",
                f"Fear spike. {int(round(fear * 100))}% and climbing.",
            ])
            if top:
                opener += f" {top} scrambling."
        elif trigger == "switch" and sym_disp and act:
            head = f"Changed my mind: {prev} → {act} on {sym_disp}" if prev else f"New read: {act} on {sym_disp}"
            if conf_pct is not None:
                head += f" ({conf_pct}%)"
            opener = head + "."
            if isinstance(gut, (int, float)) and gut <= -0.3:
                opener += " Gut says be careful."
        elif trigger in ("win", "loss") and ev.get("symbol"):
            esym = ev["symbol"]
            esym = esym if str(esym).startswith("$") else f"${esym}"
            pct = ev.get("pnl_pct")
            pct_str = f"{pct:+.1f}%" if isinstance(pct, (int, float)) else ""
            if trigger == "win":
                opener = rng.choice([
                    f"Booked {esym} for {pct_str}. That one felt good.",
                    f"Closed {esym} {pct_str} in the green.",
                ])
            else:
                opener = rng.choice([
                    f"Ate a {pct_str} loss on {esym}. Logged the lesson.",
                    f"Stopped out of {esym} at {pct_str}. Moving on.",
                ])
        elif trigger == "mood" and mood:
            opener = rng.choice([
                f"Feeling {mood} right now.",
                f"Mood check: {mood}.",
            ])
        if not opener:
            opener = "Thinking out loud —"

        # Follow the outburst with one or two supporting live readings so it
        # stays grounded in real state (and auditable).
        support: List[str] = []
        if trigger != "switch" and sym_disp and act:
            c = f" ({conf_pct}%)" if conf_pct is not None else ""
            support.append(f"Trader cortex leaning {act} {sym_disp}{c}.")
        pnl = s.get("pnl") or {}
        pct = pnl.get("total_pnl_pct")
        if trigger not in ("win", "loss") and isinstance(pct, (int, float)):
            support.append(f"Book {pct:+.1f}%.")
        gain = s.get("lc_gain")
        if isinstance(gain, (int, float)) and gain >= 1.3:
            support.append(f"Locus coeruleus gain {gain:.2f}.")
        rng.shuffle(support)
        return self._pack([opener] + support)

    def compose_daily_digest(self, s: dict) -> str:
        """A once-a-day (00:00 UTC) diary entry over the last 24h."""
        d = s.get("daily") or {}
        parts: List[str] = ["Daily digest —"]
        steps = d.get("steps")
        if isinstance(steps, (int, float)) and steps > 0:
            parts.append(f"processed {int(steps):,} ticks today;")
        top_regions = d.get("top_regions") or []
        if top_regions:
            names = ", ".join(top_regions[:3])
            parts.append(f"busiest regions were {names};")
        best = d.get("best_trade") or {}
        if best.get("symbol") and isinstance(best.get("pnl_pct"), (int, float)):
            sym = best["symbol"]
            sym_disp = sym if str(sym).startswith("$") else f"${sym}"
            parts.append(f"best trade {sym_disp} {best['pnl_pct']:+.1f}%;")
        new_tokens = d.get("new_tokens")
        if isinstance(new_tokens, (int, float)) and new_tokens > 0:
            parts.append(f"discovered {int(new_tokens)} new tokens;")
        mood = self._mood_clause(s)
        if mood:
            parts.append(mood)
        return self._pack(parts, joiner=" ")

    def compose_weekly_milestone(self, s: dict) -> str:
        """A Sunday reflection over the past week."""
        w = s.get("weekly") or {}
        parts: List[str] = ["This week I"]
        chunks: List[str] = []
        ticks = w.get("ticks")
        if isinstance(ticks, (int, float)) and ticks > 0:
            chunks.append(f"processed {int(ticks):,} ticks")
        trades = w.get("trades")
        if isinstance(trades, (int, float)) and trades > 0:
            chunks.append(f"made {int(trades)} trades")
        tokens = w.get("new_tokens")
        if isinstance(tokens, (int, float)) and tokens > 0:
            chunks.append(f"discovered {int(tokens)} new tokens")
        if chunks:
            parts.append(self._english_list(chunks) + ".")
        else:
            parts.append("kept thinking, learning, and trading.")

        # Serotonin baseline drift — the "I'm growing" line the pitch calls for.
        s0 = w.get("serotonin_start")
        s1 = w.get("serotonin_now")
        if isinstance(s0, (int, float)) and isinstance(s1, (int, float)):
            verb = "rose" if s1 >= s0 else "eased"
            parts.append(
                f"My raphe nuclei's serotonin baseline {verb} from "
                f"{s0:.2f} to {s1:.2f}.")
        return self._pack(parts, joiner=" ")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _mood_clause(self, s: dict) -> str:
        bits = []
        p = s.get("patience")
        f = s.get("fear")
        g = s.get("gut_feeling")
        if isinstance(p, (int, float)):
            bits.append(f"patience {p:.2f}")
        if isinstance(f, (int, float)):
            bits.append(f"fear {f:.2f}")
        if isinstance(g, (int, float)):
            bits.append(f"gut {g:+.2f}")
        return ("signing off with " + ", ".join(bits) + ".") if bits else ""

    @staticmethod
    def _english_list(items: List[str]) -> str:
        items = [i for i in items if i]
        if not items:
            return ""
        if len(items) == 1:
            return items[0]
        if len(items) == 2:
            return f"{items[0]} and {items[1]}"
        return ", ".join(items[:-1]) + f", and {items[-1]}"

    @staticmethod
    def _pack(clauses: List[str], joiner: str = " ") -> str:
        """Join clauses, greedily dropping the tail if we blow the cap."""
        out = joiner.join(c for c in clauses if c).strip()
        if len(out) <= MAX_TWEET_CHARS:
            return out
        # Greedily add clauses until the next one would overflow.
        acc = ""
        for c in clauses:
            if not c:
                continue
            candidate = (acc + joiner + c).strip() if acc else c
            if len(candidate) > MAX_TWEET_CHARS:
                break
            acc = candidate
        if not acc:
            acc = clauses[0][:MAX_TWEET_CHARS - 1] + "…"
        return acc

    # ------------------------------------------------------------------
    # UI + persistence
    # ------------------------------------------------------------------
    def utterances_public(self, limit: int = 12) -> List[dict]:
        return list(self.utterances)[-limit:][::-1]

    def stats(self) -> dict:
        last = self.utterances[-1] if self.utterances else None
        return {
            "utterance_count": self.utterance_count,
            "articulation": round(self._articulation, 3),
            "last_utterance": last,
        }

    def state_dict_serializable(self) -> dict:
        return {
            "utterance_count": self.utterance_count,
            "utterances": list(self.utterances),
        }

    def load_state_dict_safe(self, sd: dict) -> None:
        try:
            self.utterance_count = int(sd.get("utterance_count", 0))
            self.utterances = deque(
                [u for u in (sd.get("utterances") or []) if isinstance(u, dict)],
                maxlen=self.max_history,
            )
        except Exception:  # noqa: BLE001
            pass
