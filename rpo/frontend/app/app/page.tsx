"use client";

import Link from "next/link";
import { IPOCard } from "@/components/IPOCard";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";
import {
  computeBoost,
  IPO_SEEDS,
  useDemoStore,
} from "@/lib/demoStore";
import { useCountdown } from "@/lib/useCountdown";
import { fmtUSD } from "@/lib/format";

export default function AppHomePage() {
  const { stakedRPO, totalStakedPool, subscriptions } = useDemoStore();
  const boost = computeBoost(stakedRPO, totalStakedPool);

  const active = IPO_SEEDS.filter(
    (s) => s.status === "Subscribing" || s.status === "Announced"
  );
  const recent = IPO_SEEDS.filter((s) => s.status === "Fulfilled");

  return (
    <div className="p-5 lg:p-10">
      <header className="flex items-end justify-between mb-10 gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-3">IPO calendar</div>
          <h1 className="font-display text-4xl lg:text-5xl text-ink-900">
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
          <Badge variant="forest" dot>
            Active · {active.filter((x) => x.status === "Subscribing").length}
          </Badge>
          <div className="h-4 w-px bg-line" />
          <div className="text-xs text-ink-500">
            Your boost: <span className="text-ink-900 font-mono">{boost.toFixed(2)}×</span>
            {subscriptions.length > 0 && (
              <>
                {" · "}
                <span className="text-forest-500 font-mono">
                  {subscriptions.length} active subscription
                  {subscriptions.length > 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((ipo) => (
            <LiveIPOCard key={ipo.ticker} ipo={ipo} boost={boost} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-xl font-semibold text-ink-900">Recently fulfilled</h2>
          <Link
            href="/app/leaderboard"
            className="link text-sm inline-flex items-center gap-1"
          >
            View leaderboard <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="card divide-y divide-line">
          {recent.map((r) => (
            <div
              key={r.ticker}
              className="p-5 flex items-center justify-between hover:bg-paper-100 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 flex items-center justify-center text-sm font-semibold text-white">
                  {r.ticker.slice(0, 2)}
                </div>
                <div>
                  <div className="text-ink-900 font-semibold">{r.ticker}</div>
                  <div className="text-xs text-ink-500">{r.name}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-8 text-right">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
                    Fill
                  </div>
                  <div className="font-mono text-sm text-ink-900 mt-1">
                    {fmtUSD(r.seedSubscribedUSD, { compact: true })} /{" "}
                    {fmtUSD(r.targetUSD, { compact: true })}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
                    Launch price
                  </div>
                  <div className="font-mono text-sm text-ink-900 mt-1">
                    ${r.fillPrice?.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
                    24h
                  </div>
                  <div
                    className={
                      "font-mono text-sm mt-1 " +
                      ((r.change24hPct ?? 0) >= 0
                        ? "text-forest-500"
                        : "text-rose-600")
                    }
                  >
                    {(r.change24hPct ?? 0) >= 0 ? "+" : ""}
                    {r.change24hPct?.toFixed(1)}%
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

/** Wraps IPOCard with a real ticking countdown from the seed's launchAtMs */
function LiveIPOCard({
  ipo,
  boost,
}: {
  ipo: (typeof IPO_SEEDS)[number];
  boost: number;
}) {
  const remaining = useCountdown(ipo.launchAtMs);
  return (
    <IPOCard
      ticker={ipo.ticker}
      name={ipo.name}
      subscribedUSD={ipo.seedSubscribedUSD}
      targetUSD={ipo.targetUSD}
      expectedPrice={ipo.expectedPrice}
      countdownSec={remaining}
      boost={boost}
      status={ipo.status as "Subscribing" | "Announced"}
    />
  );
}
