"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Badge } from "@/components/ui/Badge";
import { fmtUSD, shortAddr } from "@/lib/format";
import { computeBoost, useDemoStore } from "@/lib/demoStore";

type Row = {
  addr: string;
  ens?: string;
  subscribed: number;
  pnl: number;
  boost: number;
  fills: number;
  claimed: number;
};

const SEED: Row[] = [
  { addr: "0x9812fA0344", ens: "harrison.eth", subscribed: 484_200, pnl: 92_400, boost: 2.71, fills: 14, claimed: 38_400 },
  { addr: "0x1F44Cd0209", ens: "0xmaki.eth", subscribed: 412_100, pnl: 74_300, boost: 2.44, fills: 12, claimed: 31_200 },
  { addr: "0x8802AA0021", subscribed: 388_600, pnl: 68_100, boost: 2.31, fills: 11, claimed: 28_100 },
  { addr: "0xC01D8FE12B", ens: "delphi.eth", subscribed: 344_800, pnl: 62_900, boost: 2.19, fills: 12, claimed: 24_800 },
  { addr: "0x2233CC1204", subscribed: 302_100, pnl: 51_200, boost: 2.02, fills: 10, claimed: 21_600 },
  { addr: "0xB009EE0091", ens: "wintermute.eth", subscribed: 291_400, pnl: 48_800, boost: 1.98, fills: 9, claimed: 19_800 },
  { addr: "0x7742FF1188", subscribed: 260_500, pnl: 42_300, boost: 1.84, fills: 8, claimed: 17_200 },
  { addr: "0x3311DA2288", ens: "safe.eth", subscribed: 244_800, pnl: 39_100, boost: 1.79, fills: 8, claimed: 15_800 },
  { addr: "0x5A8fCC4432", subscribed: 224_600, pnl: 36_000, boost: 1.71, fills: 7, claimed: 14_600 },
  { addr: "0x1284DD9911", subscribed: 210_800, pnl: 32_900, boost: 1.66, fills: 7, claimed: 13_100 },
  { addr: "0x89A1BB3344", subscribed: 192_100, pnl: 27_400, boost: 1.55, fills: 6, claimed: 11_800 },
  { addr: "0xEE0011AA22", subscribed: 178_800, pnl: 24_100, boost: 1.49, fills: 6, claimed: 10_700 },
  { addr: "0xDD2244CC33", subscribed: 165_400, pnl: 20_600, boost: 1.42, fills: 5, claimed: 9_800 },
  { addr: "0x4488EE9911", subscribed: 148_200, pnl: 17_800, boost: 1.36, fills: 5, claimed: 8_600 },
  { addr: "0x6688CC7722", subscribed: 132_900, pnl: 14_200, boost: 1.31, fills: 4, claimed: 7_400 },
];

type Metric = "subscribed" | "pnl" | "claimed" | "fills";
type Period = "7d" | "30d" | "all";

export default function LeaderboardPage() {
  const { address } = useAccount();
  const { stakedRPO, totalStakedPool, subscriptions, holdings } = useDemoStore();
  const [metric, setMetric] = useState<Metric>("subscribed");
  const [period, setPeriod] = useState<Period>("30d");

  const rows = [...SEED].sort((a, b) => b[metric] - a[metric]);

  // Inject the user's own row if connected
  const userRow: Row | null = address
    ? {
        addr: address,
        ens: undefined,
        subscribed: subscriptions.reduce((a, s) => a + s.amountUSDG, 0),
        pnl: 0,
        boost: computeBoost(stakedRPO, totalStakedPool),
        fills: holdings.length,
        claimed: holdings.reduce((a, h) => a + h.amount * h.entryPrice, 0),
      }
    : null;

  const userRank = userRow
    ? rows.filter((r) => r[metric] > userRow[metric]).length + 1
    : null;

  return (
    <div className="p-5 lg:p-10 max-w-6xl">
      <header className="mb-10">
        <div className="eyebrow mb-3">Leaderboard</div>
        <h1 className="font-display text-4xl lg:text-5xl text-ink-900">
          Who&apos;s subscribing the most.
        </h1>
        <p className="mt-3 text-ink-500 max-w-2xl">
          Ranked by on-chain activity across every SubscriptionVault. Boost
          reflects current staked share.
        </p>
      </header>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-full border border-line bg-white p-1">
          {(["subscribed", "pnl", "claimed", "fills"] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={
                "text-xs px-3 py-1.5 rounded-full capitalize transition-colors " +
                (metric === m
                  ? "bg-ink-900 text-white"
                  : "text-ink-500 hover:text-ink-900")
              }
            >
              {m === "pnl" ? "PnL" : m}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-full border border-line bg-white p-1">
          {(["7d", "30d", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={
                "text-xs px-3 py-1.5 rounded-full transition-colors " +
                (period === p
                  ? "bg-ink-900 text-white"
                  : "text-ink-500 hover:text-ink-900")
              }
            >
              {p}
            </button>
          ))}
        </div>
        {userRow && userRank && (
          <div className="ml-auto text-xs text-ink-500 font-mono">
            You are ranked{" "}
            <span className="text-ink-900 font-semibold">#{userRank}</span>{" "}
            of {rows.length + 1}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-[0.14em] text-ink-500 bg-paper-100">
              <th className="text-left p-4 font-normal w-16">#</th>
              <th className="text-left p-4 font-normal">Wallet</th>
              <th className="text-right p-4 font-normal">Subscribed</th>
              <th className="text-right p-4 font-normal">PnL</th>
              <th className="text-right p-4 font-normal">Boost</th>
              <th className="text-right p-4 font-normal">Fills</th>
              <th className="text-right p-4 font-normal">Claimed value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const rank = i + 1;
              return (
                <tr
                  key={r.addr}
                  className="border-b border-line last:border-0 hover:bg-paper-100 transition-colors"
                >
                  <td className="p-4 text-ink-500 font-mono">
                    {rank === 1 ? "🏆" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-full border border-line"
                        style={{
                          background: `linear-gradient(135deg, ${randomHue(r.addr)} 0%, #0A0A0A 100%)`,
                        }}
                      />
                      <div>
                        <div className="text-ink-900 font-medium">
                          {r.ens ?? shortAddr(r.addr)}
                        </div>
                        {r.ens && (
                          <div className="text-xs text-ink-500 font-mono">
                            {shortAddr(r.addr)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono text-ink-900 tabular-nums">
                    {fmtUSD(r.subscribed, { compact: true })}
                  </td>
                  <td
                    className={
                      "p-4 text-right font-mono tabular-nums " +
                      (r.pnl >= 0 ? "text-forest-500" : "text-rose-600")
                    }
                  >
                    {r.pnl >= 0 ? "+" : ""}
                    {fmtUSD(r.pnl, { compact: true })}
                  </td>
                  <td className="p-4 text-right font-mono text-ink-900 tabular-nums">
                    {r.boost.toFixed(2)}×
                  </td>
                  <td className="p-4 text-right font-mono text-ink-500 tabular-nums">
                    {r.fills}
                  </td>
                  <td className="p-4 text-right font-mono text-ink-900 tabular-nums">
                    {fmtUSD(r.claimed, { compact: true })}
                  </td>
                </tr>
              );
            })}
            {userRow && userRank && (
              <tr className="bg-forest-50 border-t-2 border-forest-500">
                <td className="p-4 text-forest-500 font-mono font-bold">
                  #{userRank}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-forest-500 to-forest-700" />
                    <div>
                      <div className="text-ink-900 font-medium">You</div>
                      <div className="text-xs text-ink-500 font-mono">
                        {shortAddr(userRow.addr)}
                      </div>
                    </div>
                    <Badge variant="forest" dot>
                      YOU
                    </Badge>
                  </div>
                </td>
                <td className="p-4 text-right font-mono text-ink-900 tabular-nums">
                  {fmtUSD(userRow.subscribed, { compact: true })}
                </td>
                <td className="p-4 text-right font-mono text-forest-500 tabular-nums">
                  +{fmtUSD(userRow.pnl, { compact: true })}
                </td>
                <td className="p-4 text-right font-mono text-ink-900 tabular-nums">
                  {userRow.boost.toFixed(2)}×
                </td>
                <td className="p-4 text-right font-mono text-ink-500 tabular-nums">
                  {userRow.fills}
                </td>
                <td className="p-4 text-right font-mono text-ink-900 tabular-nums">
                  {fmtUSD(userRow.claimed, { compact: true })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-xs text-ink-500 text-center">
        Snapshot every 5 minutes. Full historical data on{" "}
        <a href="https://dune.com/rpo" className="text-forest-500 hover:underline">
          dune.com/rpo
        </a>
        .
      </div>
    </div>
  );
}

function randomHue(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffff;
  const hue = h % 360;
  return `hsl(${hue}, 65%, 60%)`;
}
