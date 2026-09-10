import { Container } from "@/components/ui/Container";

/**
 * Pre-launch stats: no live volume, no live subscribers, no staked $RPO.
 * The bar advertises what the site will show once the protocol goes live,
 * without inventing any of the numbers.
 */
const STATS = [
  {
    label: "Contracts deployed",
    value: "0",
    hint: "audits + deploy pending",
  },
  {
    label: "Cumulative volume",
    value: "—",
    hint: "no mainnet yet",
  },
  {
    label: "Active subscribers",
    value: "—",
    hint: "no mainnet yet",
  },
  {
    label: "$RPO staked",
    value: "—",
    hint: "token not launched",
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
