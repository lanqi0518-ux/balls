"""Smoke test for Broca's area + the TwitterVoice service (dry-run)."""
from __future__ import annotations

import os
import sys
import warnings

warnings.filterwarnings("ignore")
os.environ.setdefault("WEB_EMBODIMENT", "0")
os.environ.setdefault("TWITTER_DRY_RUN", "1")
os.environ.setdefault("DATA_DIR", "/tmp/dbrain-test-data")

import torch  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.brain import Brain  # noqa: E402
from backend.twitter_voice import TwitterVoice  # noqa: E402


def synth_obs(step: int) -> dict:
    torch.manual_seed(step)
    return {
        "image": torch.rand(3, 9, 9),
        "danger": 0.9 if step % 7 == 0 else 0.1,
        "reward": 1.0 if step % 5 == 0 else (-1.0 if step % 11 == 0 else 0.0),
        "position": (step % 9, (step * 3) % 9),
        "done": False,
    }


class FakePaper:
    positions: dict = {}
    closed: list = []

    def snapshot(self, prices):
        return {
            "total_pnl_pct": 12.4, "total_pnl_usd": 1240.0,
            "realized_pnl_usd": 800.0, "win_rate": 0.62,
            "n_trades_closed": 21, "equity_usd": 11240.0,
        }


class FakeTokens:
    def snapshot(self):
        return []


class FakeTrading:
    def __init__(self):
        self.paper = FakePaper()
        self.tokens = FakeTokens()
        self._latest_intent = {
            "symbol": "WIF", "action_name": "buy",
            "confidence": 0.81, "price_change_h1": 4.2,
        }


def main() -> int:
    b = Brain()
    names = [r.meta.name for r in b.regions]
    print(f"regions: {len(b.regions)} -> {'broca' in names and 'broca OK' or 'NO BROCA'}")
    assert len(b.regions) == 21, f"expected 21 regions, got {len(b.regions)}"

    for i in range(1, 60):
        info = b.step(synth_obs(i))

    snap = b.snapshot()
    assert "broca_stats" in snap and "broca_utterances" in snap
    broca_region = [r for r in snap["regions"] if r["name"] == "broca"][0]
    print("broca region activation:", broca_region["activation"],
          "display:", broca_region["display_name"])

    voice = TwitterVoice(b, FakeTrading())
    print("dry_run:", voice.dry_run, "| has_credentials:", voice.has_credentials)

    state = voice._gather_state()
    print("\n--- gathered state ---")
    for k, v in state.items():
        print(f"  {k}: {v}")

    print("\n--- STATUS tweets (5 samples) ---")
    for s in range(5):
        t = b.broca.compose_status(state, seed=s)
        print(f"[{len(t):>3}c] {t}")

    state["daily"] = voice._daily_window()
    print("\n--- DAILY digest ---")
    d = b.broca.compose_daily_digest(state)
    print(f"[{len(d):>3}c] {d}")

    state["weekly"] = voice._weekly_window()
    state["weekly"]["serotonin_start"] = 0.52
    state["weekly"]["serotonin_now"] = 0.61
    state["weekly"]["ticks"] = 120000
    state["weekly"]["trades"] = 34
    state["weekly"]["new_tokens"] = 58
    print("\n--- WEEKLY milestone ---")
    w = b.broca.compose_weekly_milestone(state)
    print(f"[{len(w):>3}c] {w}")

    print("\n--- emotion_state ---")
    emo = b.emotion_state()
    print(" ", emo)

    print("\n--- SPONTANEOUS tweets (per trigger) ---")
    st = voice._gather_state()
    st["event"] = {"symbol": "POPCAT", "pnl_pct": 42.0, "reason": "take_profit_42%"}
    st.setdefault("trader_intent", {})["prev_action_name"] = "BUY"
    for trig in ("panic", "switch", "win", "loss", "mood"):
        t = b.broca.compose_spontaneous(trig, st, seed=7)
        print(f"[{trig:>6}] [{len(t):>3}c] {t}")
        assert len(t) <= 279, f"spontaneous {trig} too long: {len(t)}"

    # Exercise the emit path (dry-run) + persistence markers.
    voice._emit("status", b.broca.compose_status(state, seed=99))
    vs = voice.snapshot()
    print("\n--- voice.snapshot() ---")
    print("  enabled:", vs["enabled"], "dry_run:", vs["dry_run"],
          "utterance_count:", vs["utterance_count"],
          "next_status_in_s:", vs["next_status_in_s"])
    print("  latest utterance:", vs["utterances"][0]["text"][:80] if vs["utterances"] else None)

    # All tweets under the cap?
    for kind, txt in [("status", state and b.broca.compose_status(state, seed=1)),
                      ("daily", d), ("weekly", w)]:
        assert len(txt) <= 279, f"{kind} too long: {len(txt)}"
    print("\nALL OK — every tweet within 279 chars.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
