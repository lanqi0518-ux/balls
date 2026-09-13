"""Smoke test for the learning service against live feeds (needs network).

Runs a couple of read cycles with a stub brain and prints what the brain
would have learned. No trading, no tweeting, no browser.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.learning_service import LearningService  # noqa: E402


class StubBrain:
    def __init__(self):
        self.learned_concepts = []
        self._ids = set()
        self.step_count = 0

    def learn_concept(self, *, concept_id, category, zh, en,
                      desc_zh="", desc_en="", quiet=False):
        if concept_id in self._ids:
            return False
        self._ids.add(concept_id)
        self.learned_concepts.append(
            {"id": concept_id, "category": category, "en": en, "zh": zh,
             "desc_en": desc_en})
        return True


async def main():
    brain = StubBrain()
    svc = LearningService(brain, interval_s=3.0, learn_per_cycle=3)
    await svc.start()
    # Run enough cycles to touch several sources.
    await asyncio.sleep(8.0 + 3.0 * 6)
    await svc.stop()

    snap = svc.snapshot()
    print(f"sources={snap['sources']}")
    print(f"cycles={snap['cycles_done']} items_read={snap['items_read']} "
          f"learned_new={snap['learned_new']} knowledge_total={snap['knowledge_total']}")
    print(f"reading_now={ (snap['reading_now'] or {}).get('title') }")
    print("--- recent learned ---")
    for c in brain.learned_concepts[:12]:
        print(f"[{c['category']}] {c['en']}")
    print("--- errors ---")
    for e in snap["errors"]:
        print(e)
    assert snap["knowledge_total"] > 0, "brain learned nothing"
    print("\nOK: brain grew its knowledge from live feeds.")


if __name__ == "__main__":
    asyncio.run(main())
