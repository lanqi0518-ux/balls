import { cache } from "react";
import type { IpoCalendar, IpoRow } from "./types";
import { fetchNasdaqIpoCalendar } from "./nasdaq";
import { fetchEdgarIpoPipeline } from "./edgar";
import { STOCK_TOKENS } from "@/lib/robinhood/tokens";

/**
 * Global IPO calendar aggregator.
 *
 * Combines every real, public IPO data source RPO has an unblocked
 * feed for:
 *   - Nasdaq public IPO calendar     (US, priced/upcoming/filed/withdrawn)
 *   - SEC EDGAR full-text search      (US S-1 + foreign F-1 pipeline)
 *
 * Deduplicates: a Nasdaq row for the same ticker takes precedence over
 * an EDGAR row, because Nasdaq has richer pricing/exchange fields.
 *
 * Never returns fake rows. If both sources fail the calendar comes
 * back empty and `sources.*.ok = false`; the UI must surface that
 * state honestly.
 */

/**
 * Wrapped in `React.cache` so that when multiple Server Components on
 * the same page (Hero, StatsBar, FeaturedIPOs, GlobalIpoCalendar) all
 * call this, they share a single fetch — critical for the sub-60s
 * static generation window during `next build`.
 */
export const readGlobalIpoCalendar = cache(
  async (): Promise<IpoCalendar> => {
  const [nasdaq, edgar] = await Promise.all([
    fetchNasdaqIpoCalendar(1),
    fetchEdgarIpoPipeline(),
  ]);

  const nasdaqCompanyKeys = new Set<string>();
  const nasdaqTickerKeys = new Set<string>();
  for (const row of [
    ...nasdaq.upcoming,
    ...nasdaq.priced,
    ...nasdaq.filed,
    ...nasdaq.withdrawn,
  ]) {
    nasdaqCompanyKeys.add(row.companyName.toLowerCase());
    if (row.ticker) nasdaqTickerKeys.add(row.ticker.toUpperCase());
  }

  const edgarFiled = edgar.rows.filter((r) => {
    if (nasdaqCompanyKeys.has(r.companyName.toLowerCase())) return false;
    if (r.ticker && nasdaqTickerKeys.has(r.ticker.toUpperCase())) return false;
    return true;
  });

  const filed: IpoRow[] = [...nasdaq.filed, ...edgarFiled];
  filed.sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));

  const upcoming = [...nasdaq.upcoming].sort((a, b) =>
    (a.eventDate ?? "9999").localeCompare(b.eventDate ?? "9999")
  );
  const priced = [...nasdaq.priced].sort((a, b) =>
    (b.eventDate ?? "").localeCompare(a.eventDate ?? "")
  );
  const withdrawn = [...nasdaq.withdrawn].sort((a, b) =>
    (b.eventDate ?? "").localeCompare(a.eventDate ?? "")
  );

  return {
    upcoming,
    priced,
    filed,
    withdrawn,
    sources: {
      nasdaq: {
        ok: nasdaq.ok,
        fetchedAt: nasdaq.fetchedAt,
        error: nasdaq.error,
      },
      edgar: {
        ok: edgar.ok,
        fetchedAt: edgar.fetchedAt,
        error: edgar.error,
      },
    },
  };
});

/**
 * Match an IPO row to the Robinhood Stock Token registry.
 *
 * Returns the ticker string if RPO has that ticker tokenized on
 * Robinhood Chain (a real ERC-20 exists), otherwise null. The UI
 * uses this to flip an IPO row from "Not yet on RH Chain" to
 * "Vault open · subscribe →" when Robinhood mints a matching token.
 *
 * Today this returns null for every scanned IPO row — none of the
 * companies in the current Nasdaq / EDGAR calendar have been minted
 * as a Robinhood Stock Token yet. This is deliberate honesty: when
 * one is minted, `STOCK_TOKENS` in `lib/robinhood/tokens.ts` picks
 * it up and this match will start returning hits.
 */
export function matchTokenizedTicker(row: IpoRow): string | null {
  if (!row.ticker) return null;
  const t = row.ticker.toUpperCase();
  const hit = STOCK_TOKENS.find((s) => s.ticker.toUpperCase() === t);
  return hit ? hit.ticker : null;
}

export function countIpoTotals(cal: IpoCalendar): {
  total: number;
  upcoming: number;
  priced: number;
  filed: number;
  withdrawn: number;
  tokenized: number;
} {
  const all: IpoRow[] = [
    ...cal.upcoming,
    ...cal.priced,
    ...cal.filed,
    ...cal.withdrawn,
  ];
  return {
    total: all.length,
    upcoming: cal.upcoming.length,
    priced: cal.priced.length,
    filed: cal.filed.length,
    withdrawn: cal.withdrawn.length,
    tokenized: all.filter((r) => matchTokenizedTicker(r) != null).length,
  };
}
