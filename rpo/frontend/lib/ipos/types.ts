/**
 * Canonical IPO calendar row type used across every data source.
 *
 * Every field is either populated from a real public source (Nasdaq
 * IPO calendar, SEC EDGAR full-text search) or explicitly `null` /
 * `undefined`. Nothing is fabricated. If a field is missing from the
 * upstream feed, we surface `null` in the UI, never a made-up value.
 */

export type IpoStage =
  | "Upcoming"     // priced range set, expected date announced
  | "Priced"       // shares priced / traded
  | "Filed"        // S-1 / F-1 filed with SEC, no price yet
  | "Withdrawn";   // pulled or expired

export type IpoSource = "Nasdaq" | "SEC EDGAR";

export type IpoRow = {
  /** Stable id (Nasdaq dealID or SEC accession number). */
  id: string;

  /** Ticker if proposed / assigned, otherwise null. */
  ticker: string | null;

  /** Legal issuer name as it appears in the filing. */
  companyName: string;

  /** Data provenance. Every row must carry this so the UI can
   *  attribute claims. */
  source: IpoSource;

  /** Current stage in the IPO lifecycle. */
  stage: IpoStage;

  /** Listing venue. May be null for pure SEC filings that haven't
   *  named an exchange yet. */
  exchange: string | null;

  /** Country of the issuer's business, as reported by the SEC.
   *  Non-null primarily for F-1 (foreign private issuer) rows. */
  country: string | null;

  /** Raw price range as reported, e.g. "15.00-17.00" or "10.00".
   *  Kept as a string so we don't invent precision. */
  priceRange: string | null;

  /** Number of shares offered, as reported. */
  sharesOffered: string | null;

  /** Dollar value of the offering, as reported, e.g. "$391,000,000". */
  dealSizeUsd: string | null;

  /** ISO date string for the expected pricing / priced / filed date. */
  eventDate: string | null;

  /** Label describing what `eventDate` represents. */
  eventLabel: "Expected pricing" | "Priced" | "Filed" | "Withdrawn";

  /** Deep link back to the primary source for the row. Always a real,
   *  clickable URL (Nasdaq deal detail, SEC filing index). */
  sourceUrl: string;

  /** For SEC-sourced rows: CIK & accession number for building deep
   *  links to the full prospectus. */
  cik?: string;
  accession?: string;

  /** SIC industry code, if known. */
  sicCode?: string;
};

export type IpoCalendar = {
  upcoming: IpoRow[];
  priced: IpoRow[];
  filed: IpoRow[];
  withdrawn: IpoRow[];
  /** Per-source health. Lets the UI honestly say "Nasdaq is live,
   *  EDGAR failed" if only part of the pipeline is reachable. */
  sources: {
    nasdaq: { ok: boolean; fetchedAt: number; error?: string };
    edgar: { ok: boolean; fetchedAt: number; error?: string };
  };
};

export function ipoRowKey(row: IpoRow): string {
  return `${row.source}:${row.id}`;
}
