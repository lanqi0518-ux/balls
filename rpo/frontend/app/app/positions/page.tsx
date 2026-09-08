"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { ArrowUpRight, Wallet } from "@/components/ui/Icons";
import {
  computeBoost,
  findIPO,
  useDemoStore,
} from "@/lib/demoStore";
import { useCountdown } from "@/lib/useCountdown";
import { useTx } from "@/lib/useTx";
import { fmtUSD, fmtNum, fmtCountdown } from "@/lib/format";

// Mock current market prices for tokens the user holds (in a real app read
// from Chainlink oracles).
const MARKET_PRICES: Record<string, number> = {
  dCORZ: 20.02,
  dRDDT: 25.61,
  dSTRIPE: 85.2,
  dKLARNA: 32.0,
};

export default function PositionsPage() {
  const { isConnected } = useAccount();
  const {
    subscriptions,
    holdings,
    history,
    balanceUSDG,
    stakedRPO,
    totalStakedPool,
    cancel,
    claim,
  } = useDemoStore();
  const { pending, run } = useTx();

  const boost = computeBoost(stakedRPO, totalStakedPool);

  // Portfolio math
  const holdingsValue = holdings.reduce(
    (acc, h) => acc + h.amount * (MARKET_PRICES[h.ticker] ?? h.entryPrice),
    0
  );
  const activeValue = subscriptions.reduce((a, s) => a + s.amountUSDG, 0);
  const realizedPnL = holdings.reduce(
    (acc, h) =>
      acc + h.amount * ((MARKET_PRICES[h.ticker] ?? h.entryPrice) - h.entryPrice),
    0
  );

  return (
    <div className="p-5 lg:p-10 max-w-6xl">
      <header className="mb-10">
        <div className="eyebrow mb-3">Portfolio</div>
        <h1 className="font-display text-4xl lg:text-5xl text-ink-900">
          Your positions
        </h1>
      </header>

      {!isConnected ? (
        <div className="card p-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-paper-100 border border-line flex items-center justify-center mx-auto mb-6">
            <Wallet className="h-6 w-6 text-ink-500" />
          </div>
          <div className="text-ink-900 text-lg font-medium mb-2">
            Wallet not connected
          </div>
          <div className="text-ink-500 text-sm mb-6">
            Connect a wallet to see your active subscriptions and Stock-Token
            holdings.
          </div>
          <div className="inline-flex">
            <ConnectButton size="md" variant="primary" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-4 mb-10">
            <SummaryCard
              label="Total value"
              value={fmtUSD(holdingsValue + activeValue + balanceUSDG)}
            />
            <SummaryCard
              label="Active subs"
              value={fmtUSD(activeValue)}
              hint={`${subscriptions.length} vault${
                subscriptions.length === 1 ? "" : "s"
              }`}
            />
            <SummaryCard
              label="Unrealized PnL"
              value={`${realizedPnL >= 0 ? "+" : ""}${fmtUSD(realizedPnL)}`}
              tone={realizedPnL >= 0 ? "forest" : "rose"}
            />
            <SummaryCard
              label="Boost"
              value={`${boost.toFixed(2)}×`}
              tone="forest"
              hint={`${stakedRPO.toLocaleString()} $RPO staked`}
            />
          </div>

          <section className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <Badge variant="forest" dot>
                Active · {subscriptions.length}
              </Badge>
              <div className="text-xs text-ink-500">
                Cancel any time before the subscription deadline for 100% refund
              </div>
            </div>
            {subscriptions.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="text-sm text-ink-500 mb-4">
                  No active subscriptions yet.
                </div>
                <Link href="/app" className="btn-primary text-sm">
                  Browse IPO calendar
                </Link>
              </div>
            ) : (
              <div className="card divide-y divide-line">
                {subscriptions.map((s) => {
                  const ipo = findIPO(s.ticker);
                  return (
                    <ActiveRow
                      key={s.id}
                      sub={s}
                      launchAtMs={ipo?.launchAtMs ?? Date.now()}
                      expectedPrice={ipo?.expectedPrice ?? 1}
                      onCancel={() =>
                        run(() => cancel(s.id), {
                          loading: "Signing cancel() …",
                          success: `Refunded ${fmtUSD(s.amountUSDG)}`,
                        })
                      }
                      pending={pending}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <section className="mb-12">
            <h2 className="text-xl font-semibold text-ink-900 mb-5">Holdings</h2>
            {holdings.length === 0 ? (
              <div className="card p-8 text-center text-sm text-ink-500">
                No Stock Tokens claimed yet.
              </div>
            ) : (
              <div className="card divide-y divide-line">
                {holdings.map((h) => {
                  const mark = MARKET_PRICES[h.ticker] ?? h.entryPrice;
                  const value = h.amount * mark;
                  const changePct = ((mark - h.entryPrice) / h.entryPrice) * 100;
                  return (
                    <div
                      key={h.ticker}
                      className="p-5 flex items-center justify-between hover:bg-paper-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 flex items-center justify-center text-sm font-semibold text-white">
                          {h.ticker.slice(1, 3)}
                        </div>
                        <div>
                          <div className="text-ink-900 font-semibold">
                            {h.ticker}
                          </div>
                          <div className="text-xs text-ink-500">
                            {fmtNum(h.amount)} tokens · entry $
                            {h.entryPrice.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-8 text-right">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
                            Mark
                          </div>
                          <div className="font-mono text-sm text-ink-900 mt-1">
                            ${mark.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
                            Value
                          </div>
                          <div className="font-mono text-sm text-ink-900 mt-1">
                            {fmtUSD(value)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
                            PnL
                          </div>
                          <div
                            className={
                              "font-mono text-sm mt-1 " +
                              (changePct >= 0
                                ? "text-forest-500"
                                : "text-rose-600")
                            }
                          >
                            {changePct >= 0 ? "+" : ""}
                            {changePct.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => {}, // sell would call adapter.sell — stub
                              {
                                loading: `Selling ${h.ticker} …`,
                                success: `Sold at $${mark.toFixed(2)}`,
                              }
                            )
                          }
                        >
                          Sell
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => {},
                              {
                                loading: `Looping ${h.ticker} → Morpho → next IPO …`,
                                success: "Looped into next vault",
                              }
                            )
                          }
                        >
                          Loop
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink-900 mb-5">History</h2>
            <div className="card overflow-hidden">
              {history.length === 0 ? (
                <div className="p-8 text-center text-sm text-ink-500">
                  No transactions yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-[0.14em] text-ink-500">
                      <th className="text-left p-4 font-normal">When</th>
                      <th className="text-left p-4 font-normal">Ticker</th>
                      <th className="text-left p-4 font-normal">Action</th>
                      <th className="text-right p-4 font-normal">Size</th>
                      <th className="text-right p-4 font-normal">Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 20).map((h) => (
                      <tr
                        key={h.id + h.hash}
                        className="border-b border-line last:border-0 hover:bg-paper-100 transition-colors"
                      >
                        <td className="p-4 text-ink-500 font-mono">
                          {relative(h.ts)}
                        </td>
                        <td className="p-4 text-ink-900">
                          {h.ticker ?? "—"}
                        </td>
                        <td className="p-4 text-ink-500">{h.kind}</td>
                        <td className="p-4 text-right text-ink-900 font-mono">
                          {h.amount}
                        </td>
                        <td className="p-4 text-right">
                          <a
                            href="#"
                            className="text-forest-500 hover:underline inline-flex items-center gap-1 font-mono text-xs"
                          >
                            {h.hash.slice(0, 8)}…
                            <ArrowUpRight className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ActiveRow({
  sub,
  launchAtMs,
  expectedPrice,
  onCancel,
  pending,
}: {
  sub: { id: string; ticker: string; amountUSDG: number; weight: number };
  launchAtMs: number;
  expectedPrice: number;
  onCancel: () => void;
  pending: boolean;
}) {
  const remaining = useCountdown(launchAtMs);
  const expected = sub.amountUSDG / expectedPrice;
  return (
    <div className="p-5 flex items-center justify-between hover:bg-paper-100 transition-colors">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 flex items-center justify-center text-sm font-semibold text-white">
          {sub.ticker.slice(0, 2)}
        </div>
        <div>
          <div className="text-ink-900 font-semibold">{sub.ticker}</div>
          <div className="text-xs text-ink-500">
            {fmtUSD(sub.amountUSDG)} subscribed · launch in{" "}
            {fmtCountdown(remaining)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 text-right">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
            Expected
          </div>
          <div className="font-mono text-sm text-ink-900 mt-1">
            {fmtNum(expected, 4)} d{sub.ticker}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
            Weight
          </div>
          <div className="font-mono text-sm text-forest-500 mt-1 font-semibold">
            {sub.weight.toLocaleString()}
          </div>
        </div>
      </div>
      <div className="flex gap-2 ml-4">
        <Button variant="outline" size="sm" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
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
  tone?: "forest" | "rose";
}) {
  return (
    <div className="card p-6">
      <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500">
        {label}
      </div>
      <div
        className={
          "font-display text-3xl tabular-nums mt-3 " +
          (tone === "forest"
            ? "text-forest-500"
            : tone === "rose"
            ? "text-rose-600"
            : "text-ink-900")
        }
      >
        {value}
      </div>
      {hint && <div className="text-xs text-ink-500 mt-2">{hint}</div>}
    </div>
  );
}

function relative(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(ts).toISOString().slice(0, 10);
}
