"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ArrowUpRight, Wallet } from "@/components/ui/Icons";

const ACTIVE = [
  {
    ticker: "STRIPE",
    amountUSDG: 500,
    launchIn: "3d 4h",
    expected: 5.88,
    weight: "1,250 pts",
  },
];

const HOLDINGS = [
  {
    ticker: "dCORZ",
    amount: 120.5,
    valueUSD: 2412,
    changePct: 18,
    entry: 17.05,
    now: 20.02,
  },
  {
    ticker: "dRDDT",
    amount: 34.2,
    valueUSD: 876,
    changePct: -4,
    entry: 26.7,
    now: 25.61,
  },
];

const HISTORY = [
  { date: "2026-08-14", ticker: "dCORZ", action: "Claim", size: "120.5", price: "$17.05" },
  { date: "2026-08-14", ticker: "STRIPE", action: "Subscribe", size: "$500", price: "—" },
  { date: "2026-07-22", ticker: "dRDDT", action: "Claim", size: "34.2", price: "$26.70" },
  { date: "2026-07-22", ticker: "REDDIT", action: "Subscribe", size: "$920", price: "—" },
];

export default function PositionsPage() {
  const { isConnected } = useAccount();

  return (
    <div className="p-5 lg:p-10 max-w-6xl">
      <header className="mb-10">
        <div className="eyebrow mb-3">Portfolio</div>
        <h1 className="font-display text-4xl lg:text-5xl text-fg">
          Your positions
        </h1>
      </header>

      {!isConnected ? (
        <div className="card p-12 text-center">
          <div className="h-14 w-14 rounded-full bg-ink-700 border border-line-strong flex items-center justify-center mx-auto mb-6">
            <Wallet className="h-6 w-6 text-fg-muted" />
          </div>
          <div className="text-fg text-lg font-medium mb-2">
            Wallet not connected
          </div>
          <div className="text-fg-muted text-sm mb-6">
            Connect a wallet to see your active subscriptions and Stock-Token
            holdings.
          </div>
          <Button variant="primary" size="md">
            Connect wallet
          </Button>
        </div>
      ) : (
        <>
          <PortfolioSummary />

          <section className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <Badge variant="mint" dot>
                Active · {ACTIVE.length}
              </Badge>
              <div className="text-xs text-fg-muted">
                Cancel any time before the subscription deadline for 100% refund
              </div>
            </div>
            <div className="card divide-y divide-line">
              {ACTIVE.map((row) => (
                <div
                  key={row.ticker}
                  className="p-5 flex items-center justify-between hover:bg-ink-800/60 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-ink-700 border border-line-strong flex items-center justify-center text-sm font-semibold text-fg">
                      {row.ticker.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-fg font-semibold">{row.ticker}</div>
                      <div className="text-xs text-fg-muted">
                        ${row.amountUSDG} subscribed · launch in {row.launchIn}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-8 text-right">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                        Expected
                      </div>
                      <div className="font-mono text-sm text-fg mt-1">
                        {row.expected} d{row.ticker}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                        Weight
                      </div>
                      <div className="font-mono text-sm text-mint-400 mt-1">
                        {row.weight}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button variant="secondary" size="sm">
                      Top up
                    </Button>
                    <Button variant="outline" size="sm">
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-xl font-semibold text-fg mb-5">Holdings</h2>
            <div className="card divide-y divide-line">
              {HOLDINGS.map((h) => (
                <div
                  key={h.ticker}
                  className="p-5 flex items-center justify-between hover:bg-ink-800/60 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-ink-700 border border-line-strong flex items-center justify-center text-sm font-semibold text-fg">
                      {h.ticker.slice(1, 3)}
                    </div>
                    <div>
                      <div className="text-fg font-semibold">{h.ticker}</div>
                      <div className="text-xs text-fg-muted">
                        {h.amount} tokens · entry ${h.entry}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-8 text-right">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                        Mark
                      </div>
                      <div className="font-mono text-sm text-fg mt-1">
                        ${h.now}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                        Value
                      </div>
                      <div className="font-mono text-sm text-fg mt-1">
                        ${h.valueUSD.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                        PnL
                      </div>
                      <div
                        className={
                          "font-mono text-sm mt-1 " +
                          (h.changePct >= 0
                            ? "text-mint-400"
                            : "text-red-400")
                        }
                      >
                        {h.changePct >= 0 ? "+" : ""}
                        {h.changePct}%
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button variant="secondary" size="sm">
                      Sell
                    </Button>
                    <Button variant="outline" size="sm">
                      Loop
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-fg mb-5">History</h2>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-[0.14em] text-fg-dim">
                    <th className="text-left p-4 font-normal">Date</th>
                    <th className="text-left p-4 font-normal">Ticker</th>
                    <th className="text-left p-4 font-normal">Action</th>
                    <th className="text-right p-4 font-normal">Size</th>
                    <th className="text-right p-4 font-normal">Price</th>
                    <th className="text-right p-4 font-normal">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {HISTORY.map((h, i) => (
                    <tr
                      key={i}
                      className="border-b border-line last:border-0 hover:bg-ink-800/60 transition-colors"
                    >
                      <td className="p-4 text-fg-muted font-mono">
                        {h.date}
                      </td>
                      <td className="p-4 text-fg">{h.ticker}</td>
                      <td className="p-4 text-fg-muted">{h.action}</td>
                      <td className="p-4 text-right text-fg font-mono">
                        {h.size}
                      </td>
                      <td className="p-4 text-right text-fg font-mono">
                        {h.price}
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          href="#"
                          className="text-mint-400 hover:underline inline-flex items-center gap-1"
                        >
                          view <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function PortfolioSummary() {
  return (
    <div className="grid md:grid-cols-4 gap-4 mb-10">
      <SummaryCard label="Total value" value="$3,288" />
      <SummaryCard label="Active subs" value="$500" hint="1 IPO" />
      <SummaryCard label="Realized PnL" value="+$412" tone="mint" />
      <SummaryCard label="Boost" value="2.5×" tone="mint" hint="20k $RPO staked" />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "mint";
}) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-[0.14em] text-fg-dim">
        {label}
      </div>
      <div
        className={
          "font-display text-3xl tabular-nums mt-2 " +
          (tone === "mint" ? "text-mint-400" : "text-fg")
        }
      >
        {value}
      </div>
      {hint && <div className="text-xs text-fg-muted mt-1">{hint}</div>}
    </div>
  );
}
