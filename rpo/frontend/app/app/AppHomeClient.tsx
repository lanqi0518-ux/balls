"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";
import { useActiveIPOs, useBoost } from "@/lib/onchain/reads";
import { boostToNumber } from "@/lib/onchain/units";
import { fmtNum, fmtUSD } from "@/lib/format";
import { PROTOCOL_LIVE } from "@/lib/chain";
import type { StockSnapshot } from "@/lib/robinhood/reads";

const PAGE_SIZE = 24;

type AssetTab = "All" | "US Equity" | "ETF";

export function AppHomeClient({
  underlyings,
  chainBlockNumber,
}: {
  underlyings: StockSnapshot[];
  chainBlockNumber: number | null;
}) {
  const boostRead = useBoost();
  const boost = boostToNumber(boostRead.data);
  const onchain = useActiveIPOs();
  const onchainCount = onchain.data.length;

  const [tab, setTab] = useState<AssetTab>("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"cap" | "price" | "supply">("cap");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const base = underlyings.filter((s) =>
      tab === "All" ? true : s.token.assetClass === tab
    );
    const q = query.trim().toLowerCase();
    const searched = q
      ? base.filter(
          (x) =>
            x.token.ticker.toLowerCase().includes(q) ||
            x.token.name.toLowerCase().includes(q)
        )
      : base;
    const sorted = [...searched].sort((a, b) => {
      const capA = (a.priceUsd ?? 0) * (a.totalSupply ?? 0);
      const capB = (b.priceUsd ?? 0) * (b.totalSupply ?? 0);
      if (sort === "cap") return capB - capA;
      if (sort === "price") return (b.priceUsd ?? 0) - (a.priceUsd ?? 0);
      return (b.totalSupply ?? 0) - (a.totalSupply ?? 0);
    });
    return sorted;
  }, [tab, query, sort, underlyings]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const setTabReset = (t: AssetTab) => {
    setTab(t);
    setPage(0);
  };
  const setQueryReset = (q: string) => {
    setQuery(q);
    setPage(0);
  };

  const liveCount = underlyings.filter((s) => s.priceUsd != null).length;
  const totalUnderlyingUsd = underlyings.reduce(
    (acc, s) =>
      s.priceUsd != null && s.totalSupply != null
        ? acc + s.priceUsd * s.totalSupply
        : acc,
    0
  );

  return (
    <div className="p-5 lg:p-10">
      {!PROTOCOL_LIVE && (
        <div className="card p-6 border-l-4 border-peach-500 bg-peach-50/40 mb-8">
          <Badge variant="peach">Pre-launch</Badge>
          <div className="mt-3 text-ink-900 font-semibold">
            No RPO SubscriptionVault deployed yet.
          </div>
          <p className="text-sm text-ink-500 mt-2 leading-relaxed">
            The subscribe / stake / claim flows are real code, wired to
            the configured chain. Every aftermarket Stock Token below
            is live on Robinhood Chain right now — the moment the RPO{" "}
            <code>NEXT_PUBLIC_REGISTRY_ADDRESS</code> is set, subscribe
            buttons activate against the real vault. Nothing on this
            page is simulated.
          </p>
        </div>
      )}

      <div className="card p-6 border-l-4 border-ink-900 bg-white mb-6">
        <Badge variant="dark">Primary listings · IPO calendar</Badge>
        <div className="mt-3 text-ink-900 font-semibold">
          No new IPO Stock Tokens today.
        </div>
        <p className="text-sm text-ink-500 mt-2 leading-relaxed max-w-3xl">
          Robinhood has not minted a new Reg-S IPO ticker in the
          current window. RPO&apos;s keeper watches the Jersey Reg-S
          catalog and opens a fresh subscription vault the block a
          new listing appears. Until then, the live inventory on
          Robinhood Chain is the aftermarket book below — already-
          listed public equities (AAPL, NVDA, SPY, …).
        </p>
      </div>

      <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-3">Aftermarket · Robinhood Stock Tokens on RH Chain</div>
          <h1 className="font-display text-4xl lg:text-5xl text-ink-900">
            <span className="text-forest-500 tabular-nums">
              {liveCount}
            </span>{" "}
            <span className="text-ink-500 font-normal">
              already-listed Stock Token{liveCount === 1 ? "" : "s"} on-chain.
            </span>
          </h1>
          <p className="text-sm text-ink-500 mt-3 max-w-2xl">
            Every row below is a real ERC-20 on Robinhood Chain with a
            live Chainlink price. These are <strong>not IPOs</strong>
            — they&apos;re Robinhood&apos;s tokenized secondary market
            for already-public stocks. Connect a wallet to see your
            USDG balance and — once RPO AftermarketVaults deploy —
            subscribe.{" "}
            <Link
              href="/how-it-works"
              className="text-forest-500 hover:underline"
            >
              How it works →
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
          {onchainCount > 0 && (
            <div className="text-xs text-forest-500 mt-1 font-mono">
              {onchainCount} onchain vault
              {onchainCount > 1 ? "s" : ""}
            </div>
          )}
        </div>
      </header>

      {/* ─── Live chain stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MiniCard
          label="Chain"
          value="RH Chain"
          sub="id 4663 · mainnet"
        />
        <MiniCard
          label="Latest block"
          value={
            chainBlockNumber != null ? fmtNum(chainBlockNumber, 0) : "—"
          }
          sub={chainBlockNumber != null ? "RPC live" : "RPC down"}
        />
        <MiniCard
          label="Stock Tokens"
          value={`${liveCount} / ${underlyings.length}`}
          sub="verified onchain"
        />
        <MiniCard
          label="Underlying value"
          value={
            totalUnderlyingUsd > 0
              ? totalUnderlyingUsd >= 1_000_000
                ? `$${(totalUnderlyingUsd / 1_000_000).toFixed(2)}M`
                : totalUnderlyingUsd >= 1_000
                ? `$${(totalUnderlyingUsd / 1_000).toFixed(1)}k`
                : `$${fmtNum(totalUnderlyingUsd, 0)}`
              : "—"
          }
          sub="price × supply"
        />
      </div>

      {/* ─── Filter bar ───────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center gap-3 mb-5 border border-line rounded-2xl p-3 bg-white">
          <div className="flex items-center gap-1 flex-wrap">
            {(["All", "US Equity", "ETF"] as const).map((t) => (
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
              placeholder="Search by ticker or issuer name"
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
                ["cap", "Market cap"],
                ["price", "Price"],
                ["supply", "Supply"],
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
            <span className="text-ink-900 font-mono">{paged.length}</span>{" "}
            of{" "}
            <span className="text-ink-900 font-mono">
              {filtered.length}
            </span>{" "}
            underlyings
            {query && (
              <>
                {" "}
                matching{" "}
                <span className="text-ink-900">&quot;{query}&quot;</span>
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

        {paged.length === 0 ? (
          <div className="card p-14 text-center">
            <div className="font-display text-2xl text-ink-900 mb-2">
              No underlyings match this filter.
            </div>
            <p className="text-sm text-ink-500 max-w-md mx-auto">
              Try clearing the search or switching asset class. New
              Robinhood Stock Tokens are added to the registry as
              Robinhood mints them.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paged.map((s) => (
              <UnderlyingCard
                key={s.token.ticker}
                snapshot={s}
                subscribeLive={PROTOCOL_LIVE}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function UnderlyingCard({
  snapshot,
  subscribeLive,
}: {
  snapshot: StockSnapshot;
  subscribeLive: boolean;
}) {
  const { token, priceUsd, totalSupply, updatedAt } = snapshot;
  const mktCap =
    priceUsd != null && totalSupply != null ? priceUsd * totalSupply : null;
  const ageSec = updatedAt
    ? Math.max(0, Math.floor(Date.now() / 1000) - updatedAt)
    : null;
  return (
    <Link
      href={`/app/markets/${token.ticker.toLowerCase()}`}
      className="card-hover p-6 flex flex-col gap-5 group"
    >
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 flex items-center justify-center text-white text-sm font-semibold">
          {token.ticker.slice(0, 4)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold text-ink-900">
            {token.ticker}
          </div>
          <div className="text-xs text-ink-500 truncate">{token.name}</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 mt-1 font-mono">
            {token.assetClass} · Aftermarket · Chainlink
          </div>
        </div>
        <Badge variant={priceUsd != null ? "forest" : "peach"} dot>
          {priceUsd != null ? "Live" : "RPC down"}
        </Badge>
      </div>

      <div className="space-y-1.5 text-xs">
        <Row k="Chainlink mark" v={priceUsd != null ? fmtUSD(priceUsd) : "—"} />
        <Row
          k="On-chain supply"
          v={totalSupply != null ? `${fmtNum(totalSupply, 0)} d${token.ticker}` : "—"}
        />
        <Row
          k="Market value"
          v={
            mktCap != null
              ? mktCap >= 1_000_000
                ? `$${(mktCap / 1_000_000).toFixed(2)}M`
                : mktCap >= 1_000
                ? `$${(mktCap / 1_000).toFixed(1)}k`
                : fmtUSD(mktCap)
              : "—"
          }
        />
        <Row
          k="Feed updated"
          v={
            ageSec != null
              ? ageSec < 60
                ? `${ageSec}s ago`
                : ageSec < 3600
                ? `${Math.floor(ageSec / 60)}m ago`
                : `${Math.floor(ageSec / 3600)}h ago`
              : "—"
          }
        />
      </div>

      <div className="mt-auto pt-4 border-t border-line flex items-center justify-between text-xs">
        <span className={subscribeLive ? "text-forest-500" : "text-ink-500"}>
          {subscribeLive
            ? "Subscribe vault open →"
            : "Subscribe activates after RPO deploy"}
        </span>
        <ArrowUpRight className="h-3.5 w-3.5 text-ink-400 group-hover:text-ink-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>
    </Link>
  );
}

function MiniCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-mono">
        {label}
      </div>
      <div className="font-display text-2xl text-ink-900 tabular-nums mt-1">
        {value}
      </div>
      <div className="text-[11px] text-ink-500 mt-1">{sub}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{k}</span>
      <span className="font-mono text-ink-900 tabular-nums">{v}</span>
    </div>
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
