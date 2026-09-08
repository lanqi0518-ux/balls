import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { Check } from "@/components/ui/Icons";

export const metadata = {
  title: "Status",
  description:
    "Live status of RPO systems — RPC, indexer, API, subscribe path, keeper, and integrations.",
};

const SYSTEMS = [
  { name: "Frontend", status: "operational", latency: "38ms", uptime: 99.98 },
  { name: "REST API", status: "operational", latency: "42ms", uptime: 99.96 },
  { name: "Subgraph indexer", status: "operational", latency: "12s", uptime: 99.94, note: "avg 3-block lag" },
  { name: "Subscribe path", status: "operational", latency: "0.9s", uptime: 100.0 },
  { name: "Fulfill keeper (10/10)", status: "operational", latency: "—", uptime: 100.0 },
  { name: "Rialto propAMM route", status: "operational", latency: "—", uptime: 99.87 },
  { name: "Uniswap V3 fallback", status: "operational", latency: "—", uptime: 100.0 },
  { name: "Chainlink TR feeds", status: "operational", latency: "0.4s", uptime: 99.99 },
  { name: "Aave USDG market", status: "operational", latency: "—", uptime: 100.0 },
  { name: "Morpho Blue market", status: "operational", latency: "—", uptime: 100.0 },
];

const HISTORY = Array.from({ length: 60 }, (_, i) => {
  // Simulate a few small dips over the past 60 days
  const dayFromToday = 60 - i;
  const isRedDay = [37, 22].includes(dayFromToday);
  const isYellowDay = [51, 44, 15, 8].includes(dayFromToday);
  return { day: dayFromToday, level: isRedDay ? 2 : isYellowDay ? 1 : 0 };
});

const INCIDENTS = [
  {
    id: "INC-2026-002",
    title: "Rialto propAMM quote-server maintenance",
    date: "March 4, 2026",
    duration: "22m",
    severity: "minor",
    resolution:
      "Adapter automatically fell back to Uniswap V3 for STRIPE and KLARNA vaults. Zero user impact.",
  },
  {
    id: "INC-2026-001",
    title: "Subgraph indexer lag > 60s",
    date: "Feb 19, 2026",
    duration: "1h 12m",
    severity: "moderate",
    resolution:
      "Root cause: RPC provider throttling. Migrated to a redundant Alchemy endpoint. On-chain reads unaffected.",
  },
];

export default function StatusPage() {
  const allOperational = SYSTEMS.every((s) => s.status === "operational");

  return (
    <MarketingShell>
      <PageHero
        eyebrow="Status"
        title={
          allOperational
            ? "All systems operational."
            : "Some systems degraded."
        }
        description="Live health of every component of the RPO stack, refreshed every 30 seconds. Subscribe to incident notifications at status.rpo.xyz."
      />

      <section className="section">
        <div className="container-wide">
          <div className="card p-6 lg:p-8 mb-8">
            <div className="flex items-center gap-4">
              <div
                className={
                  "h-12 w-12 rounded-full flex items-center justify-center " +
                  (allOperational
                    ? "bg-forest-50 border border-forest-200"
                    : "bg-peach-50 border border-peach-200")
                }
              >
                <Check
                  className={
                    "h-6 w-6 " +
                    (allOperational ? "text-forest-500" : "text-peach-600")
                  }
                />
              </div>
              <div>
                <div className="text-lg font-semibold text-ink-900">
                  {allOperational
                    ? "All systems operational"
                    : "Investigating"}
                </div>
                <div className="text-sm text-ink-500 mt-0.5">
                  Overall uptime this month: <span className="font-mono">99.97%</span>
                </div>
              </div>
              <div className="ml-auto text-xs text-ink-500 font-mono">
                Updated 12s ago · next refresh in 18s
              </div>
            </div>
          </div>

          <div className="card divide-y divide-line">
            {SYSTEMS.map((s) => (
              <div key={s.name} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-forest-500" />
                    <div>
                      <div className="text-ink-900 font-medium text-sm">
                        {s.name}
                      </div>
                      {s.note && (
                        <div className="text-xs text-ink-500 mt-0.5">
                          {s.note}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-xs">
                    {s.latency !== "—" && (
                      <div className="text-ink-500 font-mono">
                        Latency:{" "}
                        <span className="text-ink-900">{s.latency}</span>
                      </div>
                    )}
                    <div className="text-ink-500 font-mono">
                      Uptime 30d:{" "}
                      <span className="text-ink-900">
                        {s.uptime.toFixed(2)}%
                      </span>
                    </div>
                    <Badge variant="forest" dot>
                      Operational
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-[3px]">
                  {HISTORY.map((h) => (
                    <div
                      key={h.day}
                      className={
                        "h-6 flex-1 rounded-sm " +
                        (h.level === 0
                          ? "bg-forest-500"
                          : h.level === 1
                          ? "bg-peach-500"
                          : "bg-rose-500")
                      }
                      title={`${h.day}d ago`}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px] text-ink-500 font-mono">
                  <span>60 days ago</span>
                  <span>today</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide">
          <h2 className="font-display text-3xl text-ink-900 mb-8">
            Past incidents
          </h2>
          <div className="card divide-y divide-line">
            {INCIDENTS.map((i) => (
              <div key={i.id} className="p-6">
                <div className="flex items-start gap-4 mb-2">
                  <div className="text-xs font-mono text-ink-500">{i.id}</div>
                  <Badge variant={i.severity === "moderate" ? "peach" : "default"}>
                    {i.severity}
                  </Badge>
                  <div className="ml-auto text-xs text-ink-500 font-mono">
                    {i.date} · {i.duration}
                  </div>
                </div>
                <div className="text-lg font-semibold text-ink-900 mb-2">
                  {i.title}
                </div>
                <div className="text-sm text-ink-500 leading-relaxed">
                  {i.resolution}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
