import Link from "next/link";
import { IPOCard } from "@/components/IPOCard";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";

const ACTIVE = [
  {
    ticker: "STRIPE",
    name: "Stripe, Inc.",
    subscribedUSD: 2_300_000,
    targetUSD: 5_000_000,
    expectedPrice: 85.2,
    countdownSec: 3 * 86400 + 4 * 3600,
    boost: 2.5,
    status: "Subscribing" as const,
  },
  {
    ticker: "KLARNA",
    name: "Klarna Bank AB",
    subscribedUSD: 450_000,
    targetUSD: 3_000_000,
    expectedPrice: 32.0,
    countdownSec: 8 * 86400,
    boost: 2.5,
    status: "Subscribing" as const,
  },
  {
    ticker: "REDDIT",
    name: "Reddit, Inc.",
    subscribedUSD: 1_100_000,
    targetUSD: 4_000_000,
    expectedPrice: 47.0,
    countdownSec: 12 * 86400,
    boost: 2.5,
    status: "Announced" as const,
  },
];

const RECENT = [
  {
    ticker: "CORZ",
    name: "Core Scientific",
    fill: "$4.9M / $5.0M",
    price: "$18.40",
    change: "+18.2%",
  },
  {
    ticker: "TSMC-2",
    name: "TSMC Series 2",
    fill: "$3.1M / $3.0M",
    price: "$212.15",
    change: "+6.4%",
  },
  {
    ticker: "NVDA-B",
    name: "NVIDIA Class B",
    fill: "$2.6M / $3.0M",
    price: "$102.02",
    change: "-1.1%",
  },
];

export default function AppHomePage() {
  return (
    <div className="p-5 lg:p-10">
      <header className="flex items-end justify-between mb-10 gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-3">IPO calendar</div>
          <h1 className="font-display text-4xl lg:text-5xl text-fg">
            Live subscription windows.
          </h1>
        </div>
        <a
          href="https://api.robinhood.com/rhj/assets"
          target="_blank"
          rel="noreferrer"
          className="link text-sm inline-flex items-center gap-1.5"
        >
          Data source: /rhj/assets
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </header>

      <section className="mb-14">
        <div className="flex items-center gap-2 mb-5">
          <Badge variant="mint" dot>
            Active · {ACTIVE.filter((x) => x.status === "Subscribing").length}
          </Badge>
          <div className="h-4 w-px bg-line" />
          <div className="text-xs text-fg-muted">
            Auto-refreshes every 60s
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ACTIVE.map((ipo) => (
            <IPOCard key={ipo.ticker} {...ipo} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-xl font-semibold text-fg">Recently fulfilled</h2>
          <Link
            href="/app/leaderboard"
            className="link text-sm inline-flex items-center gap-1"
          >
            View leaderboard <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="card divide-y divide-line">
          {RECENT.map((r) => (
            <div
              key={r.ticker}
              className="p-5 flex items-center justify-between hover:bg-ink-800/60 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-ink-700 border border-line-strong flex items-center justify-center text-sm font-semibold text-fg">
                  {r.ticker.slice(0, 2)}
                </div>
                <div>
                  <div className="text-fg font-semibold">{r.ticker}</div>
                  <div className="text-xs text-fg-muted">{r.name}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-8 text-right">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                    Fill
                  </div>
                  <div className="font-mono text-sm text-fg mt-1">{r.fill}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                    Launch price
                  </div>
                  <div className="font-mono text-sm text-fg mt-1">
                    {r.price}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                    24h
                  </div>
                  <div
                    className={
                      "font-mono text-sm mt-1 " +
                      (r.change.startsWith("+")
                        ? "text-mint-400"
                        : "text-red-400")
                    }
                  >
                    {r.change}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
