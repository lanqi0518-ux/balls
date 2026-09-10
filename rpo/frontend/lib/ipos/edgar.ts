import type { IpoRow } from "./types";

/**
 * SEC EDGAR full-text search client for S-1 / F-1 filings.
 *
 *   - S-1 → US domestic issuer, primary IPO registration
 *   - F-1 → foreign private issuer, primary IPO registration
 *     (covers Chinese, Israeli, European, LatAm issuers listing in the US)
 *
 * The full-text endpoint powering EDGAR's public search UI:
 *   https://efts.sec.gov/LATEST/search-index?forms=S-1,F-1&dateRange=custom&startdt=...&enddt=...
 *
 * Returns JSON. Requires a well-behaved User-Agent (SEC guidance).
 * No API key.
 */

const ENDPOINT = "https://efts.sec.gov/LATEST/search-index";

// SEC requires a descriptive User-Agent per their rate-limit policy.
// See https://www.sec.gov/os/accessing-edgar-data
const UA = "rpo-web/1.0 (contact: rpo@robinhoodipo.example)";

type EdgarHit = {
  _id?: string;
  _source?: {
    ciks?: string[];
    display_names?: string[];
    file_date?: string;
    form?: string;
    root_forms?: string[];
    adsh?: string;
    biz_locations?: string[];
    biz_states?: string[];
    sics?: string[];
    file_type?: string;
  };
};

type EdgarResp = {
  hits?: {
    total?: { value?: number };
    hits?: EdgarHit[];
  };
};

/**
 * Extract the country from EDGAR's `biz_locations` array. Format is
 * roughly "City, ST" for US, or "City, CC" where CC is a 2-letter
 * ISO country code, or just "Country" for some foreign filers.
 */
function extractCountry(loc: string | undefined): string | null {
  if (!loc) return null;
  const parts = loc.split(",").map((s) => s.trim());
  const tail = parts[parts.length - 1];
  if (!tail) return null;
  return tail;
}

/**
 * Extract company name (strip the trailing "(CIK 0001234567)").
 */
function cleanDisplayName(dn: string | undefined): string | null {
  if (!dn) return null;
  return dn.replace(/\s*\(CIK\s*\d+\)\s*$/i, "").trim() || null;
}

/**
 * Build a link to the filing index on EDGAR.
 */
function edgarFilingUrl(cik: string, adsh: string): string {
  const noDash = adsh.replace(/-/g, "");
  const cikNumeric = cik.replace(/^0+/, "") || cik;
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cikNumeric}&type=&dateb=&owner=include&count=40`;
}

function edgarPrimaryDocUrl(cik: string, adsh: string): string {
  const noDash = adsh.replace(/-/g, "");
  const cikNumeric = cik.replace(/^0+/, "") || cik;
  return `https://www.sec.gov/Archives/edgar/data/${cikNumeric}/${noDash}/`;
}

async function fetchEdgar(form: "S-1" | "F-1", startdt: string, enddt: string): Promise<IpoRow[]> {
  const params = new URLSearchParams({
    q: '"initial public offering"',
    forms: form,
    dateRange: "custom",
    startdt,
    enddt,
  });
  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
    },
    next: { revalidate: 300 },
    // SEC EDGAR can be slow; cap so a laggy response never stalls
    // a page render.
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`SEC EDGAR ${form}: HTTP ${res.status}`);
  const data = (await res.json()) as EdgarResp;
  const hits = data.hits?.hits ?? [];
  const rows: IpoRow[] = [];
  const seenCiks = new Set<string>();
  for (const h of hits) {
    const s = h._source;
    if (!s) continue;
    const cik = s.ciks?.[0];
    const adsh = s.adsh;
    if (!cik || !adsh) continue;
    if (seenCiks.has(cik)) continue;
    seenCiks.add(cik);
    const companyName = cleanDisplayName(s.display_names?.[0]);
    if (!companyName) continue;
    const country = extractCountry(s.biz_locations?.[0]);
    const filedDate = s.file_date ?? null;
    rows.push({
      id: adsh,
      ticker: null,
      companyName,
      source: "SEC EDGAR",
      stage: "Filed",
      exchange: null,
      country,
      priceRange: null,
      sharesOffered: null,
      dealSizeUsd: null,
      eventDate: filedDate,
      eventLabel: "Filed",
      sourceUrl: edgarPrimaryDocUrl(cik, adsh),
      cik,
      accession: adsh,
      sicCode: s.sics?.[0],
    });
  }
  return rows;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch the S-1 (US domestic) and F-1 (foreign private issuer) full-text
 * search results for the last 60 days. Returns a combined, deduplicated
 * list. F-1 filings are surfaced with `country` populated so the UI can
 * label them as global issuers using the US listings pipeline.
 */
export async function fetchEdgarIpoPipeline(): Promise<{
  ok: boolean;
  fetchedAt: number;
  error?: string;
  rows: IpoRow[];
}> {
  const enddt = new Date().toISOString().slice(0, 10);
  const startdt = isoDaysAgo(60);
  try {
    const [s1, f1] = await Promise.all([
      fetchEdgar("S-1", startdt, enddt),
      fetchEdgar("F-1", startdt, enddt),
    ]);
    const rows = [...s1, ...f1];
    // Deduplicate on CIK — a company that filed both an amendment and
    // an initial should only appear once.
    const byCik = new Map<string, IpoRow>();
    for (const r of rows) {
      if (!r.cik) continue;
      const existing = byCik.get(r.cik);
      if (!existing) {
        byCik.set(r.cik, r);
      } else if ((r.eventDate ?? "") > (existing.eventDate ?? "")) {
        byCik.set(r.cik, r);
      }
    }
    const deduped = Array.from(byCik.values());
    deduped.sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));
    return {
      ok: true,
      fetchedAt: Math.floor(Date.now() / 1000),
      rows: deduped,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[ipos] SEC EDGAR fetch failed:", message);
    return {
      ok: false,
      fetchedAt: Math.floor(Date.now() / 1000),
      error: message,
      rows: [],
    };
  }
}
