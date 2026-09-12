import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight, ArrowUpRight } from "@/components/ui/Icons";
import { readGlobalIpoCalendar } from "@/lib/ipos/aggregate";
import { matchTokenizedTicker } from "@/lib/ipos/aggregate";
import type { IpoRow } from "@/lib/ipos/types";

/**
 * Home-page section that surfaces the real global IPO deal flow —
 * live from Nasdaq's public IPO calendar and SEC EDGAR (S-1 + F-1).
 *
 * Every row is a real, verifiable public filing. Each row is tagged
 * with its `sourceUrl` (Nasdaq deal detail or the SEC filing folder)
 * so the reader can double-check.
 *
 * The section renders a compact preview (top upcoming + priced + a
 * few filed). The full calendar lives at `/ipos`.
 */
export async function GlobalIpoCalendar() {
  const cal = await readGlobalIpoCalendar();

  const previewUpcoming = cal.upcoming.slice(0, 4);
  const previewPriced = cal.priced.slice(0, 4);
  const previewFiled = cal.filed.slice(0, 4);

  const totalPipeline =
    cal.upcoming.length + cal.priced.length + cal.filed.length;

  const anyOk = cal.sources.nasdaq.ok || cal.sources.edgar.ok;

  return (
    <Section id="global-ipos">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-6">
        <div className="max-w-2xl">
          <div className="eyebrow mb-5">
            Global IPO calendar · live from Nasdaq &amp; SEC EDGAR
          </div>
          <h2 className="font-display text-display-sm text-ink-900">
            Real IPO deal flow — the pipeline RPO wants to bring on-chain.
          </h2>
          <p className="text-sm text-ink-500 mt-4 max-w-xl leading-relaxed">
            Every entry below is a real public filing pulled directly
            from{" "}
            <a
              className="text-forest-500 hover:underline"
              href="https://www.nasdaq.com/market-activity/ipos"
              target="_blank"
              rel="noreferrer"
            >
              Nasdaq&apos;s IPO calendar
            </a>{" "}
            and{" "}
            <a
              className="text-forest-500 hover:underline"
              href="https://efts.sec.gov/LATEST/search-index?q=%22initial+public+offering%22&forms=S-1%2CF-1"
              target="_blank"
              rel="noreferrer"
            >
              SEC EDGAR
            </a>{" "}
            — S-1 (US) and F-1 (foreign private issuer) registrations.
            None of these are on Robinhood Chain yet. The instant
            Robinhood mints any of these tickers, its row flips to
            <em> Vault open</em> and links straight to the RPO
            subscribe surface.
          </p>
        </div>
        <LinkButton
          href="/ipos"
          variant="outline"
          size="md"
          trailingIcon={<ArrowRight className="h-4 w-4" />}
        >
          Full IPO calendar
        </LinkButton>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <SummaryStat
          label="Upcoming (priced range set)"
          value={cal.upcoming.length}
          ok={cal.sources.nasdaq.ok}
        />
        <SummaryStat
          label="Priced (last ~60 days)"
          value={cal.priced.length}
          ok={cal.sources.nasdaq.ok}
        />
        <SummaryStat
          label="Filed (S-1 + F-1 pipeline)"
          value={cal.filed.length}
          ok={cal.sources.nasdaq.ok || cal.sources.edgar.ok}
        />
        <SummaryStat
          label="Withdrawn (pulled)"
          value={cal.withdrawn.length}
          ok={cal.sources.nasdaq.ok}
        />
      </div>

      {!anyOk && (
        <div className="card p-6 border-l-4 border-peach-500 bg-peach-50/40 mb-6">
          <Badge variant="peach">Data source down</Badge>
          <div className="mt-3 text-ink-900 font-semibold">
            Neither Nasdaq nor SEC EDGAR is reachable right now.
          </div>
          <p className="text-sm text-ink-500 mt-2 leading-relaxed">
            This page never invents rows. When either source recovers,
            the calendar re-populates on the next 60-second revalidation.
          </p>
        </div>
      )}

      {previewUpcoming.length > 0 && (
        <IpoBucket title="Upcoming" tone="forest" rows={previewUpcoming} />
      )}
      {previewPriced.length > 0 && (
        <IpoBucket title="Recently priced" tone="dark" rows={previewPriced} />
      )}
      {previewFiled.length > 0 && (
        <IpoBucket title="Newly filed" tone="peach" rows={previewFiled} />
      )}

      {totalPipeline > 0 && (
        <div className="mt-6 flex items-center justify-between text-xs text-ink-500 border-t border-line pt-5">
          <span>
            Preview shows a subset of{" "}
            <span className="font-mono text-ink-900">{totalPipeline}</span>{" "}
            real filings tracked across sources.
          </span>
          <Link
            href="/ipos"
            className="inline-flex items-center gap-1 text-forest-500 hover:underline"
          >
            See all
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </Section>
  );
}

function SummaryStat({
  label,
  value,
  ok,
}: {
  label: string;
  value: number;
  ok: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-mono">
        {label}
      </div>
      <div className="font-display text-3xl text-ink-900 tabular-nums mt-1">
        {ok ? value : "—"}
      </div>
      <div className="text-[11px] text-ink-500 mt-1">
        {ok ? "live from source" : "source unreachable"}
      </div>
    </div>
  );
}

function IpoBucket({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "forest" | "dark" | "peach";
  rows: IpoRow[];
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Badge variant={tone} dot>
          {title}
        </Badge>
        <span className="text-xs text-ink-500">
          {rows.length} shown
        </span>
      </div>
      <div className="grid gap-2">
        {rows.map((r) => (
          <IpoRowCard key={`${r.source}:${r.id}`} row={r} />
        ))}
      </div>
    </div>
  );
}

function IpoRowCard({ row }: { row: IpoRow }) {
  const tokenized = matchTokenizedTicker(row);
  return (
    <div className="card p-4 flex flex-wrap items-center gap-4">
      <div className="min-w-[64px]">
        <div className="font-mono text-sm font-semibold text-ink-900">
          {row.ticker ?? "—"}
        </div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-mono">
          {row.source === "Nasdaq" ? "NASDAQ" : "SEC"}
        </div>
      </div>
      <div className="flex-1 min-w-[220px]">
        <div className="text-sm text-ink-900 font-medium truncate">
          {row.companyName}
        </div>
        <div className="text-[11px] text-ink-500 truncate">
          {[
            row.exchange,
            row.country,
            row.priceRange ? `range ${row.priceRange}` : null,
            row.sharesOffered ? `${row.sharesOffered} shs` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      <div className="text-right text-xs">
        <div className="uppercase tracking-[0.14em] text-ink-500">
          {row.eventLabel}
        </div>
        <div className="font-mono text-ink-900 tabular-nums mt-0.5">
          {row.eventDate ?? "—"}
        </div>
      </div>
      <div className="text-right text-xs min-w-[100px]">
        <div className="uppercase tracking-[0.14em] text-ink-500">
          Deal size
        </div>
        <div className="font-mono text-ink-900 tabular-nums mt-0.5">
          {row.dealSizeUsd ?? "—"}
        </div>
      </div>
      <div>
        {tokenized ? (
          <Link
            href={`/app/markets/${tokenized.toLowerCase()}`}
            className="inline-flex items-center gap-1 text-forest-500 text-xs font-semibold hover:underline"
          >
            Vault open
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        ) : (
          <span className="text-[11px] text-ink-500 whitespace-nowrap">
            Not yet on RH&nbsp;Chain
          </span>
        )}
      </div>
      <a
        href={row.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="text-[11px] text-forest-500 hover:underline inline-flex items-center gap-1"
        title={`Open source at ${row.source}`}
      >
        source
        <ArrowUpRight className="h-3 w-3" />
      </a>
    </div>
  );
}
