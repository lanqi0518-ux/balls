"use client";

import { useState, useMemo } from "react";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { fmtUSD } from "@/lib/format";
import { RPO_ADDRESSES, shortAddr } from "@/lib/addresses";
import { Search } from "@/components/ui/Icons";

type VaultRow = {
  ticker: string;
  name: string;
  vault: string;
  status: "Subscribing" | "Fulfilled" | "Refunded";
  subscribed: number;
  target: number;
  price: number;
  markNow?: number;
  subscribers: number;
  fulfillAt?: string;
  block?: number;
};

const VAULTS: VaultRow[] = [
  { ticker: "STRIPE", name: "Stripe, Inc.", vault: "0x2c8f6D1A9c37c9dE05A31c2A1e7a24aF7B4a19E5", status: "Subscribing", subscribed: 2_312_400, target: 5_000_000, price: 85.20, subscribers: 448, fulfillAt: "2026-03-18 15:00 UTC", block: 15_882_113 },
  { ticker: "KLARNA", name: "Klarna Holding AB", vault: "0x8B02BA1e77ce4ADdDb0e77d7c53c11a6A19eF5C1", status: "Subscribing", subscribed: 1_720_100, target: 4_000_000, price: 42.60, subscribers: 302, fulfillAt: "2026-03-22 14:00 UTC", block: 15_882_100 },
  { ticker: "CORZ", name: "Core Scientific", vault: "0xBb1cA3E4bA5EddCC5F27cC1F55f9C9F1D2eB43aa", status: "Fulfilled", subscribed: 3_120_800, target: 3_000_000, price: 12.20, markNow: 15.44, subscribers: 812, fulfillAt: "2026-03-06 15:00 UTC", block: 15_777_842 },
  { ticker: "RDDT", name: "Reddit, Inc.", vault: "0xd41E6d4B7eA9f2A6f1BE24aC4a1F1c68d6BbA112", status: "Fulfilled", subscribed: 4_812_400, target: 5_000_000, price: 68.40, markNow: 82.11, subscribers: 1234, fulfillAt: "2026-02-28 15:00 UTC", block: 15_720_115 },
  { ticker: "TSMC-2", name: "TSMC Series 2 tokens", vault: "0x9c8eB114e2B22D3f3aA22DDb9E44e77BeE5aA4c7", status: "Fulfilled", subscribed: 1_984_100, target: 2_000_000, price: 178.20, markNow: 190.44, subscribers: 512, fulfillAt: "2026-02-21 15:00 UTC", block: 15_620_982 },
  { ticker: "ANTHR", name: "Anthropic (Series-2)", vault: "0x3F1CcF9c8Bb1d4bB2c3f21e11cA7E2c8CaFbBe11", status: "Refunded", subscribed: 812_000, target: 3_000_000, price: 220.00, subscribers: 118, fulfillAt: "2026-02-08 15:00 UTC", block: 15_490_222 },
  { ticker: "NVDA-B", name: "NVIDIA Class-B", vault: "0x11AABBcCddEE44FF5566778899aa11BB22cc33Dd", status: "Fulfilled", subscribed: 6_120_400, target: 6_000_000, price: 812.30, markNow: 878.99, subscribers: 2244, fulfillAt: "2026-01-24 15:00 UTC", block: 15_310_411 },
  { ticker: "DBX", name: "Databricks", vault: "0x77aa11BB22cc33Dd44Ee5566778899AaBbCcDdEe", status: "Fulfilled", subscribed: 4_020_000, target: 4_000_000, price: 62.10, markNow: 74.88, subscribers: 1108, fulfillAt: "2026-01-11 15:00 UTC", block: 15_101_884 },
];

type Filter = "all" | "Subscribing" | "Fulfilled" | "Refunded";

export default function ExplorerPage() {
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filter>("all");

  const rows = useMemo(() => {
    return VAULTS.filter((v) => {
      if (f !== "all" && v.status !== f) return false;
      if (q) {
        const s = q.toLowerCase();
        if (
          !v.ticker.toLowerCase().includes(s) &&
          !v.name.toLowerCase().includes(s) &&
          !v.vault.toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [q, f]);

  const totalVolume = VAULTS.reduce((a, b) => a + b.subscribed, 0);
  const totalSubscribers = VAULTS.reduce((a, b) => a + b.subscribers, 0);
  const avgPerf = VAULTS.filter((v) => v.markNow).reduce(
    (a, v) => a + (v.markNow! / v.price - 1),
    0
  ) / VAULTS.filter((v) => v.markNow).length;

  return (
    <MarketingShell>
      <PageHero
        eyebrow="Explorer"
        title="Look up any vault, ever."
        description="Every SubscriptionVault deployed by IPORegistry, indexed and searchable. Click a row to open the on-chain page or the subscribe flow."
      />

      {/* Stats strip */}
      <section className="section-tight">
        <div className="container-wide grid md:grid-cols-4 gap-4">
          <StatBox label="Vaults deployed" value={String(VAULTS.length)} />
          <StatBox label="Cumulative volume" value={fmtUSD(totalVolume, { compact: true })} />
          <StatBox label="Subscribers" value={totalSubscribers.toLocaleString()} />
          <StatBox
            label="Avg. realized PnL"
            value={`${(avgPerf * 100).toFixed(1)}%`}
            positive={avgPerf > 0}
          />
        </div>
      </section>

      {/* Search + filter */}
      <section className="container-wide mt-4 mb-4">
        <div className="card p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[260px] flex items-center gap-2 rounded-full border border-line bg-white px-4 h-10">
            <Search className="h-4 w-4 text-ink-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ticker, name, or 0x address..."
              className="flex-1 bg-transparent outline-none text-sm text-ink-900 placeholder:text-ink-500"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="text-xs text-ink-500 hover:text-ink-900"
              >
                clear
              </button>
            )}
          </div>
          <div className="inline-flex rounded-full border border-line bg-white p-1">
            {(["all", "Subscribing", "Fulfilled", "Refunded"] as Filter[]).map((k) => (
              <button
                key={k}
                onClick={() => setF(k)}
                className={
                  "text-xs px-3 py-1.5 rounded-full transition-colors " +
                  (f === k
                    ? "bg-ink-900 text-white"
                    : "text-ink-500 hover:text-ink-900")
                }
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="pb-16 container-wide">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-100 text-xs uppercase tracking-[0.14em] text-ink-500">
                <th className="text-left p-4 font-normal">Ticker</th>
                <th className="text-left p-4 font-normal">Vault</th>
                <th className="text-right p-4 font-normal">Subscribed</th>
                <th className="text-right p-4 font-normal">Target</th>
                <th className="text-right p-4 font-normal">Price</th>
                <th className="text-right p-4 font-normal">Now</th>
                <th className="text-right p-4 font-normal">PnL</th>
                <th className="text-right p-4 font-normal">Subs</th>
                <th className="text-right p-4 font-normal">Status</th>
                <th className="text-right p-4 font-normal">Block</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const pnl = v.markNow ? v.markNow / v.price - 1 : null;
                return (
                  <tr
                    key={v.ticker}
                    className="border-b border-line last:border-0 hover:bg-paper-100 transition-colors"
                  >
                    <td className="p-4">
                      <div className="text-ink-900 font-semibold">{v.ticker}</div>
                      <div className="text-xs text-ink-500 truncate max-w-[180px]">
                        {v.name}
                      </div>
                    </td>
                    <td className="p-4">
                      <a
                        href={`${RPO_ADDRESSES.explorer}/address/${v.vault}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-ink-900 hover:underline"
                      >
                        {shortAddr(v.vault)}
                      </a>
                    </td>
                    <td className="p-4 text-right font-mono tabular-nums text-ink-900">
                      {fmtUSD(v.subscribed, { compact: true })}
                    </td>
                    <td className="p-4 text-right font-mono tabular-nums text-ink-500">
                      {fmtUSD(v.target, { compact: true })}
                    </td>
                    <td className="p-4 text-right font-mono tabular-nums text-ink-500">
                      ${v.price.toFixed(2)}
                    </td>
                    <td className="p-4 text-right font-mono tabular-nums text-ink-900">
                      {v.markNow ? `$${v.markNow.toFixed(2)}` : "—"}
                    </td>
                    <td
                      className={
                        "p-4 text-right font-mono tabular-nums " +
                        (pnl === null
                          ? "text-ink-500"
                          : pnl >= 0
                          ? "text-forest-500"
                          : "text-rose-600")
                      }
                    >
                      {pnl === null
                        ? "—"
                        : `${pnl >= 0 ? "+" : ""}${(pnl * 100).toFixed(1)}%`}
                    </td>
                    <td className="p-4 text-right text-ink-500 tabular-nums">
                      {v.subscribers}
                    </td>
                    <td className="p-4 text-right">
                      <Badge
                        variant={
                          v.status === "Subscribing"
                            ? "forest"
                            : v.status === "Fulfilled"
                            ? "dark"
                            : "peach"
                        }
                        dot={v.status === "Subscribing"}
                      >
                        {v.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right font-mono text-xs text-ink-500 tabular-nums">
                      #{v.block?.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-ink-500 text-sm">
                    No vaults match your query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-ink-500 text-center mt-4 font-mono">
          Indexed every 4s from Robinhood Chain · id {RPO_ADDRESSES.chainId} ·
          registry {shortAddr(RPO_ADDRESSES.contracts.IPORegistry)}
        </div>
      </section>
    </MarketingShell>
  );
}

function StatBox({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="card p-6">
      <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500 mb-3 font-mono">
        {label}
      </div>
      <div
        className={
          "font-display text-3xl tabular-nums " +
          (positive ? "text-forest-500" : "text-ink-900")
        }
      >
        {value}
      </div>
    </div>
  );
}
