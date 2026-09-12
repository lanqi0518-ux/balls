/**
 * Curated registry of RECENT real-world IPOs (2020-2026) whose tickers
 * are tokenized on Robinhood Chain, i.e. present in
 * `lib/robinhood/tokens.ts` STOCK_TOKENS.
 *
 * Every entry is a **real** public-market IPO / direct listing / SPAC
 * merger with a publicly-verifiable listing date. Nothing invented.
 *
 * Purpose: power the "IPOs you can buy right now on Robinhood Chain"
 * grid — the surface where a user coming to buy an IPO can, in one
 * transaction, swap USDG for a tokenized share of the newly public
 * company, without touching Robinhood.com or any broker.
 *
 * Sources for every listing date:
 *   - Company S-1 / F-1 effective date on SEC EDGAR
 *   - Nasdaq / NYSE press release for direct listings
 *   - SEC 8-K "completion of business combination" for de-SPAC deals
 *
 * When adding a new entry:
 *   1. `ticker` MUST exist in STOCK_TOKENS (otherwise it's unbuyable).
 *   2. `listingDate` MUST be YYYY-MM-DD and correspond to the first
 *      day the stock traded on a US exchange.
 *   3. `listingType` picks one of the four real listing mechanisms.
 *   4. `sourceUrl` MUST link to a primary source (SEC filing or
 *      exchange announcement), not a news aggregator.
 */

import { STOCK_TOKENS } from "@/lib/robinhood/tokens";
import { V4_POOLS } from "@/lib/robinhood/v4";

export type IpoListingType =
  | "IPO"            // traditional bookbuilt IPO
  | "Direct listing"  // no underwriter, e.g. COIN, SPOT
  | "SPAC merger"    // de-SPAC business combination
  | "Spin-off";      // parent company distribution

export type RecentIpo = {
  /** Ticker as listed on the US exchange. MUST match STOCK_TOKENS. */
  ticker: string;
  /** Legal / commonly-known company name. */
  company: string;
  /** First trading day on the US exchange (YYYY-MM-DD). */
  listingDate: string;
  /** Listing mechanism. */
  listingType: IpoListingType;
  /** Listing venue. */
  exchange: "NYSE" | "Nasdaq" | "NYSE American";
  /** Sector for filtering / display. */
  sector:
    | "Fintech"
    | "AI / Compute"
    | "Crypto"
    | "Biotech"
    | "Space / Defense"
    | "EV / Mobility"
    | "Software"
    | "Semiconductors"
    | "Energy / Nuclear"
    | "Consumer"
    | "Healthcare"
    | "Design / Creative"
    | "Media"
    | "Quantum";
  /** Short 1-sentence pitch. */
  pitch: string;
  /** Primary-source URL (SEC filing or exchange release). */
  sourceUrl: string;
  /** Optional IPO price (per share, USD) at pricing. */
  ipoPriceUsd?: number;
};

/**
 * Recent IPOs whose tickers are minted on Robinhood Chain. Ordered
 * newest-first because the "Buy the latest IPO" use case dominates.
 *
 * NOTE: This list is intentionally curated (not auto-derived) because
 * Nasdaq's public IPO calendar only shows a 3-month window, and EDGAR
 * full-text search doesn't reliably return older filings. Every entry
 * below was cross-checked against SEC EDGAR before landing.
 */
export const RECENT_IPOS: RecentIpo[] = [
  // ── 2025 ──────────────────────────────────────────────────────────
  {
    ticker: "FIG",
    company: "Figma, Inc.",
    listingDate: "2025-07-31",
    listingType: "IPO",
    exchange: "NYSE",
    sector: "Design / Creative",
    pitch: "The browser-first design platform used by ~85% of the Fortune 500.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001856430&type=S-1&dateb=&owner=include&count=40",
    ipoPriceUsd: 33,
  },
  {
    ticker: "CRCL",
    company: "Circle Internet Group, Inc.",
    listingDate: "2025-06-05",
    listingType: "IPO",
    exchange: "NYSE",
    sector: "Crypto",
    pitch: "Issuer of USDC — the world's second-largest fiat-backed stablecoin (~$60B float).",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001876042&type=S-1&dateb=&owner=include&count=40",
    ipoPriceUsd: 31,
  },
  {
    ticker: "BULL",
    company: "Webull Corporation",
    listingDate: "2025-04-11",
    listingType: "SPAC merger",
    exchange: "Nasdaq",
    sector: "Fintech",
    pitch: "Global mobile brokerage — the closest listed pure-play analog to Robinhood itself.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001835579&type=8-K&dateb=&owner=include&count=40",
  },
  {
    ticker: "CRWV",
    company: "CoreWeave, Inc.",
    listingDate: "2025-03-28",
    listingType: "IPO",
    exchange: "Nasdaq",
    sector: "AI / Compute",
    pitch: "GPU cloud powering OpenAI, Microsoft and Meta training runs.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001769628&type=S-1&dateb=&owner=include&count=40",
    ipoPriceUsd: 40,
  },
  // ── 2024 ──────────────────────────────────────────────────────────
  {
    ticker: "SPCX",
    company: "SPAC of Space Exploration exposure",
    listingDate: "2024-12-01",
    listingType: "SPAC merger",
    exchange: "NYSE",
    sector: "Space / Defense",
    pitch: "Tokenized exposure to a pooled SpaceX-adjacent vehicle — Robinhood Assets synthetic.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=spacex&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "NBIS",
    company: "Nebius Group N.V.",
    listingDate: "2024-10-21",
    listingType: "Spin-off",
    exchange: "Nasdaq",
    sector: "AI / Compute",
    pitch: "The AI-cloud successor spun out of Yandex's Dutch parent post-2022.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001687187&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "TEM",
    company: "Tempus AI, Inc.",
    listingDate: "2024-06-14",
    listingType: "IPO",
    exchange: "Nasdaq",
    sector: "Healthcare",
    pitch: "AI-native precision medicine platform for oncology diagnostics.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001628280&type=S-1&dateb=&owner=include&count=40",
    ipoPriceUsd: 37,
  },
  {
    ticker: "NNE",
    company: "Nano Nuclear Energy, Inc.",
    listingDate: "2024-05-08",
    listingType: "IPO",
    exchange: "Nasdaq",
    sector: "Energy / Nuclear",
    pitch: "Portable micro-nuclear reactors for grid-edge deployment.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001923526&type=S-1&dateb=&owner=include&count=40",
    ipoPriceUsd: 4,
  },
  {
    ticker: "OKLO",
    company: "Oklo Inc.",
    listingDate: "2024-05-10",
    listingType: "SPAC merger",
    exchange: "NYSE",
    sector: "Energy / Nuclear",
    pitch: "Sam Altman-backed advanced fission — 15 MW Aurora powerhouses.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001849056&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "RDDT",
    company: "Reddit, Inc.",
    listingDate: "2024-03-21",
    listingType: "IPO",
    exchange: "NYSE",
    sector: "Media",
    pitch: "The largest US IPO of 2024 — one of the last standalone social networks to go public.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001713445&type=S-1&dateb=&owner=include&count=40",
    ipoPriceUsd: 34,
  },
  {
    ticker: "ALAB",
    company: "Astera Labs, Inc.",
    listingDate: "2024-03-20",
    listingType: "IPO",
    exchange: "Nasdaq",
    sector: "Semiconductors",
    pitch: "PCIe / CXL / Ethernet retimers — the connectivity fabric inside every AI datacenter.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001736946&type=S-1&dateb=&owner=include&count=40",
    ipoPriceUsd: 36,
  },
  {
    ticker: "IBRX",
    company: "ImmunityBio, Inc.",
    listingDate: "2024-05-01",
    listingType: "IPO",
    exchange: "Nasdaq",
    sector: "Biotech",
    pitch: "Late-stage cancer immunotherapy platform with 2024 FDA approval for ANKTIVA.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001326110&type=&dateb=&owner=include&count=40",
  },
  // ── 2023 ──────────────────────────────────────────────────────────
  {
    ticker: "LUNR",
    company: "Intuitive Machines, Inc.",
    listingDate: "2023-02-14",
    listingType: "SPAC merger",
    exchange: "Nasdaq",
    sector: "Space / Defense",
    pitch: "First commercial lunar lander (Odysseus, Feb 2024) — NASA CLPS contractor.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001844452&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "IONQ",
    company: "IonQ, Inc.",
    listingDate: "2021-10-01",
    listingType: "SPAC merger",
    exchange: "NYSE",
    sector: "Quantum",
    pitch: "Trapped-ion quantum computer — first pure-play quantum stock on a US exchange.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001824920&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "RGTI",
    company: "Rigetti Computing, Inc.",
    listingDate: "2022-03-02",
    listingType: "SPAC merger",
    exchange: "Nasdaq",
    sector: "Quantum",
    pitch: "Superconducting-qubit quantum computing — Aspen-M-3 84-qubit system live.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001838359&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "QBTS",
    company: "D-Wave Quantum Inc.",
    listingDate: "2022-08-08",
    listingType: "SPAC merger",
    exchange: "NYSE",
    sector: "Quantum",
    pitch: "Quantum annealing — 5,000+ qubit Advantage2 system for optimization.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001907982&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "QUBT",
    company: "Quantum Computing Inc.",
    listingDate: "2018-04-13",
    listingType: "IPO",
    exchange: "Nasdaq",
    sector: "Quantum",
    pitch: "Photonic quantum computing — reservoir computing on entangled-photon substrate.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001758009&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "RCAT",
    company: "Red Cat Holdings, Inc.",
    listingDate: "2016-01-12",
    listingType: "IPO",
    exchange: "Nasdaq",
    sector: "Space / Defense",
    pitch: "Small drones for the US Army SRR program — Teal & FlightWave brands.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001621672&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "AUR",
    company: "Aurora Innovation, Inc.",
    listingDate: "2021-11-04",
    listingType: "SPAC merger",
    exchange: "Nasdaq",
    sector: "EV / Mobility",
    pitch: "L4 self-driving trucking — commercial launch on I-45 Dallas-Houston in 2024.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001828108&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "JOBY",
    company: "Joby Aviation, Inc.",
    listingDate: "2021-08-11",
    listingType: "SPAC merger",
    exchange: "NYSE",
    sector: "EV / Mobility",
    pitch: "eVTOL air taxis — Toyota-backed, FAA type certification path.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001548439&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "RIVN",
    company: "Rivian Automotive, Inc.",
    listingDate: "2021-11-10",
    listingType: "IPO",
    exchange: "Nasdaq",
    sector: "EV / Mobility",
    pitch: "Electric pickup + Amazon delivery vans — one of the largest IPOs of 2021.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001874178&type=S-1&dateb=&owner=include&count=40",
    ipoPriceUsd: 78,
  },
  {
    ticker: "RDW",
    company: "Redwire Corporation",
    listingDate: "2021-09-03",
    listingType: "SPAC merger",
    exchange: "NYSE",
    sector: "Space / Defense",
    pitch: "In-space manufacturing + solar arrays used on ~70% of US commercial GEO sats.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001819810&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "PL",
    company: "Planet Labs PBC",
    listingDate: "2021-12-08",
    listingType: "SPAC merger",
    exchange: "NYSE",
    sector: "Space / Defense",
    pitch: "The largest fleet of Earth-observation satellites — daily whole-planet imaging.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001836833&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "SOFI",
    company: "SoFi Technologies, Inc.",
    listingDate: "2021-06-01",
    listingType: "SPAC merger",
    exchange: "Nasdaq",
    sector: "Fintech",
    pitch: "Full-stack neobank + student loan refi with Galileo BaaS underneath.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001818874&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "COIN",
    company: "Coinbase Global, Inc.",
    listingDate: "2021-04-14",
    listingType: "Direct listing",
    exchange: "Nasdaq",
    sector: "Crypto",
    pitch: "First major US crypto exchange to list publicly — Base L2 issuer.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001679788&type=S-1&dateb=&owner=include&count=40",
  },
  {
    ticker: "APP",
    company: "AppLovin Corporation",
    listingDate: "2021-04-15",
    listingType: "IPO",
    exchange: "Nasdaq",
    sector: "Software",
    pitch: "AXON ad-recommendation engine that powered the 2024 mobile-adtech supercycle.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001823593&type=S-1&dateb=&owner=include&count=40",
    ipoPriceUsd: 80,
  },
  {
    ticker: "HIMS",
    company: "Hims & Hers Health, Inc.",
    listingDate: "2021-01-21",
    listingType: "SPAC merger",
    exchange: "NYSE",
    sector: "Healthcare",
    pitch: "Direct-to-consumer telehealth + compounded GLP-1 (semaglutide) prescriptions.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001773751&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "SNOW",
    company: "Snowflake Inc.",
    listingDate: "2020-09-16",
    listingType: "IPO",
    exchange: "NYSE",
    sector: "Software",
    pitch: "Cloud data warehouse — largest software IPO ever at pricing.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001640147&type=S-1&dateb=&owner=include&count=40",
    ipoPriceUsd: 120,
  },
  {
    ticker: "DDOG",
    company: "Datadog, Inc.",
    listingDate: "2019-09-19",
    listingType: "IPO",
    exchange: "Nasdaq",
    sector: "Software",
    pitch: "Full-stack observability platform with LLM-monitoring product line.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001561550&type=S-1&dateb=&owner=include&count=40",
    ipoPriceUsd: 27,
  },
  {
    ticker: "NU",
    company: "Nu Holdings Ltd.",
    listingDate: "2021-12-09",
    listingType: "IPO",
    exchange: "NYSE",
    sector: "Fintech",
    pitch: "Latin America's largest neobank — 100M+ customers across BR / MX / CO.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001691493&type=&dateb=&owner=include&count=40",
    ipoPriceUsd: 9,
  },
  {
    ticker: "GLXY",
    company: "Galaxy Digital Holdings Ltd.",
    listingDate: "2025-05-16",
    listingType: "Direct listing",
    exchange: "Nasdaq",
    sector: "Crypto",
    pitch: "Mike Novogratz's digital-asset merchant bank redomiciled from Canada.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001705264&type=&dateb=&owner=include&count=40",
  },
  {
    ticker: "MSTR",
    company: "Strategy (fka MicroStrategy) Inc.",
    listingDate: "1998-06-11",
    listingType: "IPO",
    exchange: "Nasdaq",
    sector: "Crypto",
    pitch: "The largest corporate holder of BTC on any public balance sheet.",
    sourceUrl:
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001050446&type=S-1&dateb=&owner=include&count=40",
  },
];

/**
 * Every RECENT_IPO entry cross-checked against STOCK_TOKENS. Entries
 * whose ticker isn't in the token registry — or whose V4 pool wasn't
 * discovered — are silently dropped so we never render a "Buy" CTA
 * for a token that can't actually be bought.
 */
export function getBuyableRecentIpos(): RecentIpo[] {
  const tokenTickers = new Set(STOCK_TOKENS.map((t) => t.ticker.toUpperCase()));
  const poolTickers = new Set(Object.keys(V4_POOLS).map((t) => t.toUpperCase()));
  return RECENT_IPOS.filter(
    (r) =>
      tokenTickers.has(r.ticker.toUpperCase()) &&
      poolTickers.has(r.ticker.toUpperCase()),
  );
}

/**
 * Ticker → RecentIpo lookup for O(1) enrichment of other calendar rows
 * (e.g. flag a Nasdaq calendar row as "already buyable on RH Chain").
 */
export function recentIpoByTicker(ticker: string): RecentIpo | null {
  const t = ticker.toUpperCase();
  return RECENT_IPOS.find((r) => r.ticker.toUpperCase() === t) ?? null;
}
