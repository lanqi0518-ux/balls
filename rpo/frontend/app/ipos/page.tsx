import Link from "next/link";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";
import { readGlobalIpoCalendar, matchTokenizedTicker } from "@/lib/ipos/aggregate";
import type { IpoRow, IpoStage } from "@/lib/ipos/types";

// Revalidate every 60 s so the calendar stays fresh without hammering
// Nasdaq / SEC on every request.
export const revalidate = 60;

export const metadata = {
  title: "Global IPO calendar",
  description:
    "Live IPO deal flow — every entry sourced from Nasdaq's public IPO calendar and the SEC EDGAR full-text search (S-1 US domestic + F-1 foreign private issuer). Real data only.",
};

const STAGE_META: Record<
  IpoStage,
  { label: string; tone: "forest" | "dark" | "peach" | "default" }
> = {
  Upcoming: { label: "Upcoming", tone: "forest" },
  Priced: { label: "Priced", tone: "dark" },
  Filed: { label: "Filed", tone: "peach" },
  Withdrawn: { label: "Withdrawn", tone: "default" },
};

export default async function IposPage() {
  const cal = await readGlobalIpoCalendar();

  const bySource = {
    nasdaq: [
      ...cal.upcoming,
      ...cal.priced,
      ...cal.filed,
      ...cal.withdrawn,
    ].filter((r) => r.source === "Nasdaq"),
    edgar: cal.filed.filter((r) => r.source === "SEC EDGAR"),
  };

  const foreign = bySource.edgar.filter((r) => {
    const c = r.country?.toUpperCase();
    if (!c) return false;
    return !US_LOCATIONS.has(c);
  });

  return (
    <MarketingShell>
      <PageHero
        eyebrow="Global IPO calendar · live"
        title="Every real IPO in the US listings pipeline, in one place."
        description={
          <>
            Sourced live from{" "}
            <a
              href="https://www.nasdaq.com/market-activity/ipos"
              target="_blank"
              rel="noreferrer"
              className="text-forest-500 hover:underline"
            >
              Nasdaq&apos;s public IPO calendar
            </a>{" "}
            and{" "}
            <a
              href="https://efts.sec.gov/LATEST/search-index?q=%22initial+public+offering%22&forms=S-1%2CF-1"
              target="_blank"
              rel="noreferrer"
              className="text-forest-500 hover:underline"
            >
              SEC EDGAR
            </a>
            . Nothing here is invented. Every ticker links back to its
            official filing / deal page. When Robinhood mints any of
            these tickers as a Stock Token on Robinhood Chain, the row
            flips to <em>Vault open</em> and the RPO subscription vault
            for that ticker activates automatically.
          </>
        }
      />

      <Section>
        <div className="container-wide space-y-10">
          <SourceBanner cal={cal} />

          <BucketTable
            title="Upcoming IPOs"
            hint="Priced range announced. Expected to list within the coming weeks."
            rows={cal.upcoming}
            emptyHint="No upcoming Nasdaq IPOs currently in the calendar."
          />
          <BucketTable
            title="Recently priced"
            hint="Priced and either already trading or about to open."
            rows={cal.priced}
            emptyHint="No priced IPOs reported in the current window."
          />
          <BucketTable
            title="Filed (S-1 + F-1 pipeline)"
            hint="Registered with the SEC. Not yet priced. Includes F-1 foreign private issuer registrations from Chinese, Israeli, European, and LatAm companies listing in the US."
            rows={cal.filed}
            emptyHint="No new S-1 / F-1 filings tracked in the current window."
          />
          {foreign.length > 0 && (
            <BucketTable
              title={`Foreign private issuers (${foreign.length})`}
              hint="F-1 registrations only — global companies pursuing a US listing. This is the closest thing to a real 'global' IPO pipeline available without a paid feed."
              rows={foreign}
              emptyHint="No F-1 filings in the current window."
            />
          )}
          {cal.withdrawn.length > 0 && (
            <BucketTable
              title="Withdrawn"
              hint="Pulled or expired. Kept visible so RPO's coverage stays honest."
              rows={cal.withdrawn}
              emptyHint="No withdrawn filings in the current window."
            />
          )}

          <div className="card p-6 border-l-4 border-ink-900 bg-white">
            <Badge variant="dark">Global coverage roadmap</Badge>
            <div className="mt-3 text-ink-900 font-semibold">
              Adding HKEx / LSE / JPX / Deutsche Börse next.
            </div>
            <p className="text-sm text-ink-500 mt-2 leading-relaxed max-w-3xl">
              Today RPO pulls from the largest single IPO market by dollar
              volume — the US pipeline (Nasdaq + NYSE-adjacent S-1s + all
              F-1 foreign private issuer registrations). Non-US venues
              (HKEx, LSE, JPX) publish IPO calendars but their public
              endpoints require authenticated tokens; those integrations
              will land the moment a keyless feed is available or a
              partner sponsors an API key. No fabricated global rows in
              the meantime.
            </p>
          </div>
        </div>
      </Section>
    </MarketingShell>
  );
}

function SourceBanner({ cal }: { cal: Awaited<ReturnType<typeof readGlobalIpoCalendar>> }) {
  const src = cal.sources;
  const ageNasdaq = Math.max(0, Math.floor(Date.now() / 1000) - src.nasdaq.fetchedAt);
  const ageEdgar = Math.max(0, Math.floor(Date.now() / 1000) - src.edgar.fetchedAt);
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <SourceCard
        name="Nasdaq public IPO calendar"
        ok={src.nasdaq.ok}
        age={ageNasdaq}
        error={src.nasdaq.error}
        href="https://www.nasdaq.com/market-activity/ipos"
        note="Upcoming, priced, filed, withdrawn — 3-month window"
      />
      <SourceCard
        name="SEC EDGAR full-text search"
        ok={src.edgar.ok}
        age={ageEdgar}
        error={src.edgar.error}
        href="https://efts.sec.gov/LATEST/search-index?q=%22initial+public+offering%22&forms=S-1%2CF-1"
        note="S-1 (US) + F-1 (foreign private issuer) filings — last 60 days"
      />
    </div>
  );
}

function SourceCard({
  name,
  ok,
  age,
  error,
  href,
  note,
}: {
  name: string;
  ok: boolean;
  age: number;
  error?: string;
  href: string;
  note: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-ink-900">{name}</div>
        <Badge variant={ok ? "forest" : "peach"} dot>
          {ok ? "Live" : "Unreachable"}
        </Badge>
      </div>
      <div className="text-xs text-ink-500 mt-2">{note}</div>
      <div className="text-[11px] text-ink-500 mt-3 font-mono">
        {ok ? `fetched ${fmtAge(age)} ago` : (error ?? "no response")}
      </div>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-forest-500 hover:underline mt-2"
      >
        open source
        <ArrowUpRight className="h-3 w-3" />
      </a>
    </div>
  );
}

function BucketTable({
  title,
  hint,
  rows,
  emptyHint,
}: {
  title: string;
  hint: string;
  rows: IpoRow[];
  emptyHint: string;
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-6 py-5 border-b border-line">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-display text-2xl text-ink-900">{title}</h2>
          <span className="text-xs text-ink-500 font-mono">
            {rows.length} row{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="text-sm text-ink-500 mt-1 max-w-3xl">{hint}</p>
      </div>
      {rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-ink-500">
          {emptyHint}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-ink-500 bg-paper-100">
                <th className="px-4 py-3 font-medium">Ticker</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Exchange / Country</th>
                <th className="px-4 py-3 font-medium">Price range</th>
                <th className="px-4 py-3 font-medium">Deal size</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">RH Chain</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <IpoTableRow key={`${r.source}:${r.id}`} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IpoTableRow({ row }: { row: IpoRow }) {
  const meta = STAGE_META[row.stage];
  const tokenized = matchTokenizedTicker(row);
  return (
    <tr className="border-t border-line hover:bg-paper-50">
      <td className="px-4 py-3">
        <div className="font-mono text-sm font-semibold text-ink-900">
          {row.ticker ?? "—"}
        </div>
        <Badge variant={meta.tone} className="mt-1">
          {meta.label}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="text-ink-900 truncate max-w-[260px]" title={row.companyName}>
          {row.companyName}
        </div>
        {row.sicCode && (
          <div className="text-[10px] text-ink-500 font-mono mt-0.5">
            SIC {row.sicCode}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-ink-500">
        <div>{row.exchange ?? "—"}</div>
        <div className="text-[10px] font-mono mt-0.5">
          {row.country ?? "—"}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs tabular-nums text-ink-900">
        {row.priceRange ?? "—"}
      </td>
      <td className="px-4 py-3 font-mono text-xs tabular-nums text-ink-900">
        {row.dealSizeUsd ?? "—"}
      </td>
      <td className="px-4 py-3 font-mono text-xs tabular-nums text-ink-500">
        {row.eventDate ?? "—"}
      </td>
      <td className="px-4 py-3">
        {tokenized ? (
          <Link
            href={`/app/markets/${tokenized.toLowerCase()}`}
            className="inline-flex items-center gap-1 text-forest-500 text-xs font-semibold hover:underline"
          >
            Vault open
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        ) : (
          <span className="text-[11px] text-ink-500">Not yet</span>
        )}
      </td>
      <td className="px-4 py-3">
        <a
          href={row.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-forest-500 text-xs hover:underline"
        >
          {row.source === "Nasdaq" ? "Nasdaq" : "EDGAR"}
          <ArrowUpRight className="h-3 w-3" />
        </a>
      </td>
    </tr>
  );
}

function fmtAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

// Every 2-letter code the SEC uses for a US state / territory. Used
// to identify which EDGAR rows are foreign private issuers.
const US_LOCATIONS = new Set([
  "AL", "AK", "AR", "AZ", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
  "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD",
  "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
  "PR", "VI", "GU", "AS", "MP",
]);
