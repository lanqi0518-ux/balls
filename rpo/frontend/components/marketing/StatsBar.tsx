import { Container } from "@/components/ui/Container";

const STATS = [
  { label: "Cumulative volume", value: "$8.4M", hint: "since Aug 2026" },
  { label: "IPOs subscribed", value: "12", hint: "avg fill 87%" },
  { label: "Active subscribers", value: "4,218", hint: "in 63 countries" },
  { label: "$RPO staked", value: "1.7M", hint: "39% of supply" },
];

export function StatsBar() {
  return (
    <section className="border-y border-line bg-ink-800/40">
      <Container>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-line lg:divide-x">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={
                "px-6 py-8 lg:py-10 " +
                (i >= 2 ? "border-t lg:border-t-0 border-line " : "")
              }
            >
              <div className="text-[11px] uppercase tracking-[0.14em] text-fg-dim">
                {s.label}
              </div>
              <div className="font-display text-3xl lg:text-4xl text-fg tabular-nums mt-2">
                {s.value}
              </div>
              <div className="text-xs text-fg-dim mt-2">{s.hint}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
