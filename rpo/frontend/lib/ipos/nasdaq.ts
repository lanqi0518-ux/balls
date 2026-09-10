import type { IpoRow, IpoStage } from "./types";

/**
 * Nasdaq public IPO calendar client.
 *
 * Uses the same JSON API that powers nasdaq.com/market-activity/ipos.
 * No API key. Documented informally: `date` is YYYY-MM.
 *
 * Response shape:
 *   { data: {
 *       upcoming: { upcomingTable: { rows: RawRow[] } },
 *       priced:   { rows: RawRow[] },
 *       filed:    { rows: RawRow[] },
 *       withdrawn:{ rows: RawRow[] },
 *   }}
 *
 * We fetch the current month + previous month by default so the UI
 * always has some priced deals to show even if the current month
 * happens to be quiet.
 */

const BASE = "https://api.nasdaq.com/api/ipo/calendar";

type NasdaqRawRow = {
  dealID?: string;
  proposedTickerSymbol?: string;
  companyName?: string;
  proposedExchange?: string;
  proposedSharePrice?: string | null;
  sharesOffered?: string;
  expectedPriceDate?: string;
  pricedDate?: string;
  filedDate?: string;
  dollarValueOfSharesOffered?: string;
  dealStatus?: string;
};

function toIsoFromUs(mmddyyyy: string | undefined | null): string | null {
  if (!mmddyyyy) return null;
  const parts = mmddyyyy.split("/");
  if (parts.length !== 3) return null;
  const [m, d, y] = parts;
  if (!m || !d || !y) return null;
  const mm = m.padStart(2, "0");
  const dd = d.padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function nasdaqDealUrl(dealId: string): string {
  return `https://www.nasdaq.com/market-activity/ipos/deal-detail?dealId=${encodeURIComponent(
    dealId
  )}`;
}

function normaliseRow(
  raw: NasdaqRawRow,
  stage: IpoStage,
  eventLabel: IpoRow["eventLabel"],
  eventDate: string | null
): IpoRow | null {
  const id = raw.dealID?.trim();
  const companyName = raw.companyName?.trim();
  if (!id || !companyName) return null;
  const ticker = raw.proposedTickerSymbol?.trim() || null;
  return {
    id,
    ticker,
    companyName,
    source: "Nasdaq",
    stage,
    exchange: raw.proposedExchange?.trim() || null,
    country: null,
    priceRange: raw.proposedSharePrice?.trim() || null,
    sharesOffered: raw.sharesOffered?.trim() || null,
    dealSizeUsd: raw.dollarValueOfSharesOffered?.trim() || null,
    eventDate,
    eventLabel,
    sourceUrl: nasdaqDealUrl(id),
  };
}

async function fetchMonth(month: string): Promise<{
  upcoming: IpoRow[];
  priced: IpoRow[];
  filed: IpoRow[];
  withdrawn: IpoRow[];
}> {
  const res = await fetch(`${BASE}?date=${month}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (rpo-web/1.0; +https://rpo-web.fly.dev)",
      Accept: "application/json",
    },
    // Route caching handled by ISR revalidate on the page, but hint
    // Next fetch cache too so overlapping renders share responses.
    next: { revalidate: 60 },
    // Hard cap so a slow Nasdaq response never stalls a page render.
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) {
    throw new Error(`Nasdaq IPO calendar ${month}: HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: {
      upcoming?: { upcomingTable?: { rows?: NasdaqRawRow[] } };
      priced?: { rows?: NasdaqRawRow[] };
      filed?: { rows?: NasdaqRawRow[] };
      withdrawn?: { rows?: NasdaqRawRow[] };
    };
  };
  const data = json.data ?? {};
  const upcoming = (data.upcoming?.upcomingTable?.rows ?? [])
    .map((r) =>
      normaliseRow(r, "Upcoming", "Expected pricing", toIsoFromUs(r.expectedPriceDate))
    )
    .filter((r): r is IpoRow => r !== null);
  const priced = (data.priced?.rows ?? [])
    .map((r) => normaliseRow(r, "Priced", "Priced", toIsoFromUs(r.pricedDate)))
    .filter((r): r is IpoRow => r !== null);
  const filed = (data.filed?.rows ?? [])
    .map((r) => normaliseRow(r, "Filed", "Filed", toIsoFromUs(r.filedDate)))
    .filter((r): r is IpoRow => r !== null);
  const withdrawn = (data.withdrawn?.rows ?? [])
    .map((r) =>
      normaliseRow(r, "Withdrawn", "Withdrawn", toIsoFromUs(r.filedDate))
    )
    .filter((r): r is IpoRow => r !== null);
  return { upcoming, priced, filed, withdrawn };
}

function prevMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function fetchNasdaqIpoCalendar(monthsBack = 2): Promise<{
  ok: boolean;
  fetchedAt: number;
  error?: string;
  upcoming: IpoRow[];
  priced: IpoRow[];
  filed: IpoRow[];
  withdrawn: IpoRow[];
}> {
  const now = new Date();
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
  const months = [current];
  let cursor = current;
  for (let i = 0; i < monthsBack; i += 1) {
    cursor = prevMonth(cursor);
    months.push(cursor);
  }
  try {
    const parts = await Promise.all(months.map(fetchMonth));
    const upcoming: IpoRow[] = [];
    const priced: IpoRow[] = [];
    const filed: IpoRow[] = [];
    const withdrawn: IpoRow[] = [];
    for (const p of parts) {
      upcoming.push(...p.upcoming);
      priced.push(...p.priced);
      filed.push(...p.filed);
      withdrawn.push(...p.withdrawn);
    }
    return {
      ok: true,
      fetchedAt: Math.floor(Date.now() / 1000),
      upcoming,
      priced,
      filed,
      withdrawn,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[ipos] Nasdaq fetch failed:", message);
    return {
      ok: false,
      fetchedAt: Math.floor(Date.now() / 1000),
      error: message,
      upcoming: [],
      priced: [],
      filed: [],
      withdrawn: [],
    };
  }
}
