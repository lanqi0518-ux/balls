import { Container } from "@/components/ui/Container";
import { TOTAL_LIVE, LIVE_BY_SOURCE } from "@/lib/catalog";

/**
 * Above-the-fold proof-of-life:
 *   - live vault count is derived from the current catalog snapshot
 *     (same source the /app calendar reads), so it never lies.
 *   - four other metrics are seeded and updated on release.
 */
const STATS = [
  {
    label: "Live vaults right now",
    value: TOTAL_LIVE.toLocaleString(),
    hint: `${LIVE_BY_SOURCE.Aftermarket} aftermarket · ${LIVE_BY_SOURCE["RHJ Reg-S"]} RHJ · ${LIVE_BY_SOURCE["Pons Launchpad"]} Pons`,
  },
  {
    label: "Cumulative volume",
    value: "$8.4M",
    hint: "since Aug 2026",
  },
  {
    label: "Active subscribers",
    value: "4,218",
    hint: "in 63 countries",
  },
  {
    label: "$RPO staked",
    value: "1.7M",
    hint: "39% of supply",
  },
];

export function StatsBar() {
  return (
    <section className="border-y border-line bg-paper-100">
      <Container>
        <div className="grid grid-cols-2 lg:grid-cols-4 lg:divide-x divide-line">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={
                "px-6 py-10 lg:py-14 " +
                (i >= 2 ? "border-t lg:border-t-0 border-line " : "") +
                (i > 0 ? "lg:pl-10 " : "")
              }
            >
              <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500">
                {s.label}
              </div>
              <div className="font-display text-4xl lg:text-6xl text-ink-900 tabular-nums mt-3">
                {s.value}
              </div>
              <div className="text-xs text-ink-500 mt-3">{s.hint}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
