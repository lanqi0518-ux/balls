"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IPOCard } from "@/components/IPOCard";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";
import { ActivityTicker } from "@/components/app/ActivityTicker";
import {
  ACTIVITY_FEED,
  ALL_FULFILLED,
  ALL_LIVE,
  BY_SOURCE,
  computeBoost,
  IPO_SEEDS,
  LIVE_BY_SOURCE,
  PIPELINE,
  Source,
  TOTAL_LIVE,
  useDemoStore,
} from "@/lib/demoStore";
import { useCountdown } from "@/lib/useCountdown";
import { fmtUSD } from "@/lib/format";

const SOURCE_TABS: Array<Source | "All"> = [
  "All",
  "RHJ Reg-S",
  "Aftermarket",
  "Pons Launchpad",
  "Direct Reg-S",
];

const PAGE_SIZE = 24;

export default function AppHomePage() {
  const { stakedRPO, totalStakedPool, subscriptions } = useDemoStore();
  const boost = computeBoost(stakedRPO, totalStakedPool);

  const [tab, setTab] = useState<Source | "All">("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"live" | "size" | "fill">("live");
  const [page, setPage] = useState(0);

  // ─ Filter + sort ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const base = BY_SOURCE(tab).filter(
      (x) => x.status === "Subscribing" || x.status === "Announced"
    );
    const q = query.trim().toLowerCase();
    const searched = q
      ? base.filter(
          (x) =>
            x.ticker.toLowerCase().includes(q) ||
            x.name.toLowerCase().includes(q)
        )
      : base;
    const sorted = [...searched].sort((a, b) => {
      if (sort === "size") return b.targetUSD - a.targetUSD;
      if (sort === "fill")
        return b.seedSubscribedUSD / b.targetUSD -
          a.seedSubscribedUSD / a.targetUSD;
      // "live" → Subscribing first, then Announced, then by launch time
      const scoreA = a.status === "Subscribing" ? 0 : 1;
      const scoreB = b.status === "Subscribing" ? 0 : 1;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return a.launchAtMs - b.launchAtMs;
    });
    return sorted;
  }, [tab, query, sort]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // reset page on filter change
  const setTabReset = (t: Source | "All") => {
    setTab(t);
    setPage(0);
  };
  const setQueryReset = (q: string) => {
    setQuery(q);
    setPage(0);
  };

  return (
    <div className="p-5 lg:p-10">
      {/* ─── Header + big counter ─────────────────────────────────── */}
      <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-3">IPO calendar</div>
          <h1 className="font-display text-4xl lg:text-5xl text-ink-900">
            <span className="text-forest-500 tabular-nums">{TOTAL_LIVE}</span>{" "}
            <span className="text-ink-500 font-normal">live vaults right now.</span>
          </h1>
          <p className="text-sm text-ink-500 mt-3 max-w-2xl">
            Auto-discovered from four independent pipelines. New adds every
            few hours. Connect a wallet and subscribe — no KYC, no waitlist,
            no whitelist.{" "}
            <Link
              href="/economics"
              className="text-forest-500 hover:underline"
            >
              How deal flow works →
            </Link>
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500 mb-1">
            Your boost
          </div>
          <div className="font-display text-3xl text-peach-600 tabular-nums">
            {boost.toFixed(2)}×
          </div>
          {subscriptions.length > 0 && (
            <div className="text-xs text-forest-500 mt-1 font-mono">
              {subscriptions.length} active subscription
              {subscriptions.length > 1 ? "s" : ""}
            </div>
          )}
        </div>
      </header>

      {/* ─── Source mini-stats ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {(
          [
            ["RHJ Reg-S", "bg-peach-500", "New real IPOs from Robinhood"],
            ["Aftermarket", "bg-forest-500", "Every listed stock, always-on"],
            ["Pons Launchpad", "bg-ink-900", "Post-graduation subscriptions"],
            ["Direct Reg-S", "bg-ink-400", "Curated Cayman-SPV issuers"],
            ["Reg-A+", "bg-peach-300", "SEC-qualified retail"],
          ] as Array<[Source, string, string]>
        ).map(([src, dot, sub]) => (
          <div
            key={src}
            className="card p-4 flex flex-col gap-1 hover:bg-paper-100 transition-colors cursor-pointer"
            onClick={() => setTabReset(src)}
          >
            <div className="flex items-center gap-2">
              <span className={"h-1.5 w-1.5 rounded-full " + dot} />
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-mono">
                {src}
              </span>
            </div>
            <div className="font-display text-2xl text-ink-900 tabular-nums">
              {LIVE_BY_SOURCE[src] ?? 0}
            </div>
            <div className="text-[11px] text-ink-500 leading-snug">{sub}</div>
          </div>
        ))}
      </div>

      {/* ─── Activity ticker ──────────────────────────────────────── */}
      <ActivityTicker events={ACTIVITY_FEED.slice(0, 20)} />

      {/* ─── Filter bar ───────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center gap-3 mb-5 border border-line rounded-2xl p-3 bg-white">
          <div className="flex items-center gap-1 flex-wrap">
            {SOURCE_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTabReset(t)}
                className={
                  "text-xs px-3 py-1.5 rounded-full transition-colors " +
                  (tab === t
                    ? "bg-ink-900 text-white"
                    : "text-ink-500 hover:text-ink-900 hover:bg-paper-100")
                }
              >
                {t}
              </button>
            ))}
          </div>
          <div className="h-6 w-px bg-line hidden md:block" />
          <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 rounded-full bg-paper-100">
            <SearchIcon />
            <input
              value={query}
              onChange={(e) => setQueryReset(e.target.value)}
              placeholder="Search by ticker or name (Stripe, TSLA, PENGU…)"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-500"
            />
            {query && (
              <button
                onClick={() => setQueryReset("")}
                className="text-xs text-ink-500 hover:text-ink-900"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-ink-500">Sort</span>
            {(
              [
                ["live", "Live first"],
                ["size", "Biggest"],
                ["fill", "% filled"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={
                  "px-2.5 py-1 rounded-full text-xs transition-colors " +
                  (sort === k
                    ? "bg-forest-50 text-forest-500 border border-forest-200"
                    : "text-ink-500 hover:text-ink-900")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-baseline justify-between mb-5 text-xs text-ink-500">
          <div>
            Showing{" "}
            <span className="text-ink-900 font-mono">{paged.length}</span> of{" "}
            <span className="text-ink-900 font-mono">{filtered.length}</span>{" "}
            {tab === "All" ? "vaults" : tab + " vaults"}
            {query && (
              <>
                {" "}
                matching <span className="text-ink-900">"{query}"</span>
              </>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 rounded border border-line disabled:opacity-30 hover:bg-paper-100"
                aria-label="Previous page"
              >
                ←
              </button>
              <span className="font-mono">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
                disabled={page >= totalPages - 1}
                className="px-2 py-1 rounded border border-line disabled:opacity-30 hover:bg-paper-100"
                aria-label="Next page"
              >
                →
              </button>
            </div>
          )}
        </div>

        {/* ─── Grid ─────────────────────────────────────────────── */}
        {paged.length === 0 ? (
          <div className="card p-14 text-center">
            <div className="font-display text-2xl text-ink-900 mb-2">
              No vaults match this filter.
            </div>
            <p className="text-sm text-ink-500 max-w-md mx-auto">
              Try clearing the search or switching source tabs. New adds land
              every few hours — most likely on the next keeper tick.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paged.map((ipo) => (
              <LiveIPOCard key={ipo.ticker} ipo={ipo} boost={boost} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8 text-xs">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-outline text-xs px-4 py-2 disabled:opacity-30"
            >
              ← Prev
            </button>
            <span className="text-ink-500 font-mono">
              page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="btn-outline text-xs px-4 py-2 disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        )}
      </section>

      {/* ─── Pipeline preview ─────────────────────────────────────── */}
      <section className="mt-16">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink-900">
              Pipeline · what's next
            </h2>
            <p className="text-sm text-ink-500 mt-1">
              Curated deals under legal review + Pons launches trending
              toward graduation. Public queue.
            </p>
          </div>
          <Link href="/economics" className="link text-sm">
            Deal-flow deep dive →
          </Link>
        </div>
        <div className="card divide-y divide-line">
          {PIPELINE.map((p) => {
            const dot =
              p.source === "Aftermarket"
                ? "bg-forest-500"
                : p.source === "RHJ Reg-S"
                ? "bg-peach-500"
                : p.source === "Pons Launchpad"
                ? "bg-ink-900"
                : "bg-ink-400";
            return (
              <div
                key={p.ticker}
                className="p-5 grid grid-cols-[auto_1fr_auto] gap-4 items-center hover:bg-paper-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={"h-2 w-2 rounded-full " + dot} />
                  <div className="h-9 w-9 rounded-xl bg-paper-100 border border-line flex items-center justify-center text-[10px] font-mono text-ink-500">
                    {p.ticker.slice(0, 4)}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-ink-900 font-semibold">
                      {p.ticker}
                    </span>
                    <span className="text-sm text-ink-500 truncate">
                      {p.name}
                    </span>
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <Badge className="!py-0 !px-1.5 !text-[10px]">
                      {p.source}
                    </Badge>
                    {p.note && <span className="truncate">{p.note}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-mono">
                    Opens in
                  </div>
                  <div className="font-mono tabular-nums text-sm text-ink-900 mt-0.5">
                    {p.etaDays}d ·{" "}
                    <span className="text-ink-500">
                      {fmtUSD(p.targetUSD, { compact: true })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Recently fulfilled ───────────────────────────────────── */}
      <section className="mt-16">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-xl font-semibold text-ink-900">
            Recently fulfilled ·{" "}
            <span className="text-ink-500 font-normal">last 72h</span>
          </h2>
          <Link
            href="/app/leaderboard"
            className="link text-sm inline-flex items-center gap-1"
          >
            View leaderboard <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="card divide-y divide-line max-h-[520px] overflow-auto">
          {ALL_FULFILLED.slice(0, 30).map((r) => (
            <div
              key={r.ticker}
              className="p-4 flex items-center justify-between hover:bg-paper-100 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 flex items-center justify-center text-sm font-semibold text-white">
                  {r.ticker.slice(0, 2)}
                </div>
                <div>
                  <div className="text-ink-900 font-semibold text-sm">
                    {r.ticker}
                  </div>
                  <div className="text-[11px] text-ink-500 flex items-center gap-2">
                    <span className="truncate max-w-[200px]">{r.name}</span>
                    <span className="text-ink-300">·</span>
                    <span className="font-mono">{r.source}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 text-right">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
                    Fill
                  </div>
                  <div className="font-mono text-xs text-ink-900 mt-0.5">
                    {fmtUSD(r.seedSubscribedUSD, { compact: true })}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
                    Price
                  </div>
                  <div className="font-mono text-xs text-ink-900 mt-0.5">
                    ${r.fillPrice?.toFixed(r.fillPrice && r.fillPrice < 1 ? 4 : 2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
                    24h
                  </div>
                  <div
                    className={
                      "font-mono text-xs mt-0.5 " +
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
      source={ipo.source}
    />
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-3.5 w-3.5 text-ink-500"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}
