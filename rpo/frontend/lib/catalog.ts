/**
 * Pure deal-flow catalog — no client-only code, so it's safe to import
 * from Server Components. In production this file is deleted and the
 * arrays are read from:
 *   IPORegistry.getAll()        — the authoritative on-chain list
 *   Fulfiller.getRecent(96h)    — recently-fulfilled window
 *   AssetDiscovery.pipeline()   — off-chain-signaled upcoming adds
 */

export type Source =
  | "RHJ Reg-S"
  | "Aftermarket"
  | "Pons Launchpad"
  | "Direct Reg-S"
  | "Reg-A+";

export type Status = "Subscribing" | "Announced" | "Fulfilled" | "Refunded";

export type IPOSeed = {
  ticker: string;
  name: string;
  source: Source;
  status: Status;
  targetUSD: number;
  seedSubscribedUSD: number;
  expectedPrice: number;
  /** Absolute launch timestamp (unused by UI, kept for tooling). */
  launchAtMs: number;
  /**
   * Seconds until launch (positive for Subscribing/Announced) or since
   * fulfillment (negative for Fulfilled). The UI uses THIS instead of
   * launchAtMs so a stale build never displays "Closed" for every vault
   * — the number is baked once at build time and simply ticks down on
   * the client from wherever it started.
   */
  launchOffsetSec: number;
  fillPrice?: number;
  change24hPct?: number;
  note?: string;
  /**
   * Aftermarket vaults are always-on rolling batches; there's no useful
   * countdown for them, so the UI hides the ticker for these.
   */
  alwaysOn?: boolean;
};

export type ActivityEvent = {
  ticker: string;
  amountUSDG: number;
  wallet: string;
  boost: number;
  agoSec: number;
};

export type PipelineItem = {
  ticker: string;
  name: string;
  source: Source | "Grants";
  etaDays: number;
  targetUSD: number;
  note?: string;
};

/**
 * Deterministic PRNG so every render — server or client, in any timezone —
 * produces the same catalog. Avoids hydration mismatches.
 */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0xf1e9a1);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

const RHJ_IPO_NAMES: Array<[string, string]> = [
  ["STRIPE", "Stripe, Inc."],
  ["KLARNA", "Klarna Bank AB"],
  ["REDDIT", "Reddit, Inc."],
  ["DBX", "Databricks, Inc."],
  ["SHEIN", "Roadget Business (SHEIN)"],
  ["PLTR-2", "Palantir Class B"],
  ["DISC", "Discord, Inc."],
  ["CANVA", "Canva Pty Ltd."],
  ["REVOLUT", "Revolut Group"],
  ["FIGMA", "Figma, Inc."],
  ["ZBRA", "Anthropic PBC"],
  ["XAI", "xAI Corp."],
  ["PERPLX", "Perplexity AI"],
  ["MERGE", "Mercor, Inc."],
  ["CURSOR", "Anysphere (Cursor)"],
  ["NOTION", "Notion Labs"],
  ["ARM-2", "Arm Holdings Series 2"],
  ["DEEL", "Deel, Inc."],
  ["EPIC", "Epic Games"],
  ["INSTC", "Instacart Class B"],
  ["MEIT", "Meituan (secondary)"],
  ["BYTE", "ByteDance (secondary)"],
  ["ANDU", "Anduril Industries"],
  ["SPACX", "SpaceX (secondary)"],
  ["FLOCK", "Flock Safety"],
  ["FIREW", "Fireworks AI"],
  ["ADEPT", "Adept AI Labs"],
  ["RIPP", "Ripple Labs (secondary)"],
  ["OLLM", "Ollama, Inc."],
];

const AFTERMARKET_TICKERS: Array<[string, string]> = [
  ["AAPL", "Apple Inc."], ["MSFT", "Microsoft Corp."], ["NVDA", "NVIDIA Corp."],
  ["GOOGL", "Alphabet Inc."], ["AMZN", "Amazon.com, Inc."], ["META", "Meta Platforms"],
  ["TSLA", "Tesla, Inc."], ["BRK-B", "Berkshire Hathaway B"], ["JPM", "JPMorgan Chase"],
  ["V", "Visa Inc."], ["MA", "Mastercard Inc."], ["UNH", "UnitedHealth Group"],
  ["XOM", "Exxon Mobil"], ["JNJ", "Johnson & Johnson"], ["PG", "Procter & Gamble"],
  ["LLY", "Eli Lilly"], ["AVGO", "Broadcom Inc."], ["HD", "Home Depot"],
  ["CVX", "Chevron Corp."], ["MRK", "Merck & Co."], ["ABBV", "AbbVie Inc."],
  ["COST", "Costco Wholesale"], ["ADBE", "Adobe Inc."], ["PEP", "PepsiCo"],
  ["WMT", "Walmart Inc."], ["KO", "Coca-Cola Co."], ["TMO", "Thermo Fisher Sci."],
  ["ORCL", "Oracle Corp."], ["ACN", "Accenture plc"], ["MCD", "McDonald's Corp."],
  ["CRM", "Salesforce, Inc."], ["INTC", "Intel Corp."], ["QCOM", "Qualcomm Inc."],
  ["AMD", "Advanced Micro Devices"], ["IBM", "IBM Corp."], ["NKE", "Nike, Inc."],
  ["DIS", "Walt Disney Co."], ["PYPL", "PayPal Holdings"], ["NFLX", "Netflix, Inc."],
  ["UBER", "Uber Technologies"], ["ABNB", "Airbnb, Inc."], ["SHOP", "Shopify Inc."],
  ["SQ", "Block, Inc."], ["COIN", "Coinbase Global"], ["MSTR", "MicroStrategy"],
  ["PLTR", "Palantir Technologies"], ["SNOW", "Snowflake Inc."], ["DDOG", "Datadog"],
  ["MDB", "MongoDB, Inc."], ["NET", "Cloudflare, Inc."], ["ZS", "Zscaler, Inc."],
  ["CRWD", "CrowdStrike"], ["PANW", "Palo Alto Networks"], ["OKTA", "Okta, Inc."],
  ["TEAM", "Atlassian Corp."], ["ZM", "Zoom Communications"], ["ROKU", "Roku, Inc."],
  ["PINS", "Pinterest, Inc."], ["SNAP", "Snap Inc."], ["SPOT", "Spotify Technology"],
  ["DASH", "DoorDash, Inc."], ["LYFT", "Lyft, Inc."], ["RBLX", "Roblox Corp."],
  ["U", "Unity Software"], ["TWLO", "Twilio Inc."], ["ETSY", "Etsy, Inc."],
  ["EBAY", "eBay Inc."], ["F", "Ford Motor Co."], ["GM", "General Motors"],
  ["BA", "Boeing Co."], ["LMT", "Lockheed Martin"], ["RTX", "RTX Corp."],
  ["NOC", "Northrop Grumman"], ["GE", "GE Aerospace"], ["CAT", "Caterpillar Inc."],
  ["DE", "Deere & Co."], ["MMM", "3M Company"], ["HON", "Honeywell Intl."],
  ["UPS", "United Parcel Service"], ["FDX", "FedEx Corp."], ["SBUX", "Starbucks Corp."],
  ["MDLZ", "Mondelez Intl."], ["PM", "Philip Morris Intl."], ["MO", "Altria Group"],
  ["BUD", "Anheuser-Busch InBev"], ["CL", "Colgate-Palmolive"], ["KMB", "Kimberly-Clark"],
  ["EL", "Estée Lauder Cos."], ["UL", "Unilever plc"], ["NSRGY", "Nestlé S.A."],
  ["TM", "Toyota Motor"], ["HMC", "Honda Motor Co."], ["SONY", "Sony Group"],
  ["TSM", "Taiwan Semiconductor"], ["ASML", "ASML Holding"], ["NVO", "Novo Nordisk"],
  ["AZN", "AstraZeneca plc"], ["SAP", "SAP SE"], ["SIE", "Siemens AG"],
  ["SHEL", "Shell plc"], ["BP", "BP p.l.c."], ["TTE", "TotalEnergies SE"],
  ["ENB", "Enbridge Inc."], ["RY", "Royal Bank of Canada"], ["TD", "Toronto-Dominion Bank"],
  ["BAC", "Bank of America"], ["WFC", "Wells Fargo"], ["MS", "Morgan Stanley"],
  ["GS", "Goldman Sachs"], ["C", "Citigroup Inc."], ["BLK", "BlackRock, Inc."],
  ["BX", "Blackstone Inc."], ["KKR", "KKR & Co."], ["APO", "Apollo Global Mgmt."],
  ["SPY", "SPDR S&P 500 ETF"], ["QQQ", "Invesco QQQ Trust"], ["VOO", "Vanguard S&P 500"],
  ["IWM", "iShares Russell 2000"], ["DIA", "SPDR Dow Jones"], ["VTI", "Vanguard Total Market"],
  ["ARKK", "ARK Innovation ETF"], ["SMH", "VanEck Semiconductor"], ["XLE", "Energy Select"],
  ["XLF", "Financial Select"], ["XLK", "Technology Select"], ["XLV", "Health Care Select"],
  ["GLD", "SPDR Gold Trust"], ["SLV", "iShares Silver Trust"], ["TLT", "iShares 20+ Yr Treasury"],
  ["HYG", "iShares High Yield"], ["LQD", "iShares Investment Grade"], ["VNQ", "Vanguard Real Estate"],
  ["BITO", "ProShares Bitcoin"], ["ETHE", "Grayscale Ethereum"], ["MSTR-B", "MicroStrategy Class B"],
  ["CRWV", "CoreWeave, Inc."], ["ARKQ", "ARK Autonomous & Robotics"],
];

const PONS_NAMES: Array<[string, string]> = [
  ["BONSAI", "Bonsai AI Terminal"], ["MERKLE", "Merkle Points"],
  ["ZORA", "Zora Creator Coin"], ["FRIEND", "friend.tech v3"],
  ["PUMP", "Pump Governance"], ["MOON", "Moonshot Rewards"],
  ["APED", "Aped Protocol"], ["DEGEN", "Degen Chain Token"],
  ["ORACLE", "Oracle Baby"], ["NANO", "Nano Labs"],
  ["SPACE", "Spacecoin"], ["LAIKA", "Laika Terminal"],
  ["RIALTO", "Rialto DAO"], ["HOOK", "Uniswap V4 Hooks Token"],
  ["FARC", "Farcaster Points"], ["WARP", "Warpcast Rewards"],
  ["NEYNAR", "Neynar Credits"], ["TAP", "Tap Protocol"],
  ["PAX", "PaxAI"], ["GROQ", "Groq Compute"],
  ["EIGEN", "EigenLayer Restaking"], ["BABYDOGE", "Baby Dogecoin"],
  ["CATTOWN", "Cat Town"], ["MOG", "Mog Coin"],
  ["POPCAT", "Popcat"], ["FLOKI", "Floki Inu"],
  ["SPX", "SPX6900"], ["GMEME", "Grandmeme"],
  ["OPUS", "Opus Foundation"], ["QUANTS", "Quants Terminal"],
  ["JEETS", "Antijeet"], ["SLOP", "Slop.wtf"],
  ["ALCH", "Alchemist AI"], ["VOSK", "Voskcoin"],
  ["MIGGL", "Miggles"], ["PENGU", "Pudgy Penguin"],
  ["DFISH", "Deep Fishing"], ["MOONP", "Moonpay Points"],
  ["OPENR", "OpenReader"], ["NANOF", "Nanofinance"],
  ["SIGNL", "Signal Labs"], ["TIER", "Tier Protocol"],
  ["APPS", "Appstack"], ["SEND", "Send Points"],
];

const DIRECT_ISSUERS: Array<[string, string, Source, string]> = [
  ["OAI", "OpenAI (Cayman SPV secondary)", "Direct Reg-S", "Cayman SPV in escrow · legal review passed"],
  ["NEURA", "Neura Robotics", "Direct Reg-S", "$120k legal underwriting approved"],
  ["PLURAL", "Plural Energy (Reg-A+)", "Reg-A+", "SEC qualification in progress · Q2 2027"],
  ["MERC", "Mercor Ltd (Reg-D 506c)", "Direct Reg-S", "Accredited SBT gated · US eligible"],
  ["HELION", "Helion Energy (secondary)", "Direct Reg-S", "$8M Cayman SPV, quarterly window"],
  ["FIGURE", "Figure AI (secondary)", "Direct Reg-S", "Cap table verified with underwriter"],
  ["RETO", "Retro Sports Inc.", "Reg-A+", "Reg-A Tier 2 qualified · public-market retail"],
  ["ARRAY", "Array Studios (Reg-D)", "Direct Reg-S", "506(c) · SBT-gated allocation"],
];

/**
 * Anchor timestamps to a static release moment (2026-09-08) instead of
 * Date.now(). This keeps SSR/client output stable, avoids hydration
 * warnings, and lets the deployment cache the HTML for the full year.
 */
const ANCHOR_MS = new Date("2026-09-08T00:00:00Z").getTime();

function buildIPOs(): IPOSeed[] {
  const out: IPOSeed[] = [];

  RHJ_IPO_NAMES.forEach(([ticker, name], i) => {
    const filled = between(0.05, 0.95);
    const target = Math.round(between(2, 12)) * 1_000_000;
    const price = Math.round(between(8, 240) * 100) / 100;
    let status: Status;
    if (i < 14) status = "Subscribing";
    else if (i < 22) status = "Announced";
    else status = "Fulfilled";

    // Positive offsets for Subscribing (2-14d) & Announced (14-45d).
    // Negative offsets for Fulfilled (1-25 days ago).
    const offsetSec =
      status === "Fulfilled"
        ? -Math.round(between(1, 25)) * 86_400
        : status === "Announced"
        ? Math.round(between(14, 45) * 86_400)
        : Math.round(between(2, 14) * 86_400);

    const change = Math.round(between(-6, 32) * 10) / 10;
    out.push({
      ticker,
      name,
      source: "RHJ Reg-S",
      status,
      targetUSD: target,
      seedSubscribedUSD: Math.round(target * filled),
      expectedPrice: price,
      launchAtMs: ANCHOR_MS + offsetSec * 1000,
      launchOffsetSec: offsetSec,
      fillPrice: status === "Fulfilled" ? price : undefined,
      change24hPct: status === "Fulfilled" ? change : undefined,
      note:
        status === "Announced"
          ? "Detected on /rhj/assets · propose() eligible"
          : undefined,
    });
  });

  AFTERMARKET_TICKERS.forEach(([ticker, name], i) => {
    const cap = Math.round(between(0.5, 3.5) * 1_000_000);
    const fillFrac = between(0.15, 0.95);
    const price = Math.round(between(15, 780) * 100) / 100;
    out.push({
      ticker,
      name,
      source: "Aftermarket",
      status: "Subscribing",
      targetUSD: cap,
      seedSubscribedUSD: Math.round(cap * fillFrac),
      expectedPrice: price,
      // Always-on: batch rolls every 4h. The number is decorative.
      launchAtMs: ANCHOR_MS + 4 * 3_600_000,
      launchOffsetSec: 4 * 3600,
      alwaysOn: true,
      note: "Always-on · Rialto propAMM · batch-fulfills every 4h",
    });
  });

  PONS_NAMES.forEach(([ticker, name]) => {
    const cap = Math.round(between(0.1, 1.2) * 1_000_000);
    const fillFrac = between(0.2, 0.99);
    const price = Math.round(between(0.001, 4.2) * 10_000) / 10_000;
    const roll = rand();
    let status: Status;
    if (roll < 0.6) status = "Subscribing";
    else if (roll < 0.85) status = "Fulfilled";
    else status = "Announced";

    // Subscribing Pons: 12-70h window remaining. Announced: 2-6d. Fulfilled: 2-60h ago.
    const offsetSec =
      status === "Fulfilled"
        ? -Math.round(between(2, 60)) * 3600
        : status === "Announced"
        ? Math.round(between(2, 6) * 86_400)
        : Math.round(between(12, 70) * 3600);

    const change = Math.round(between(-30, 400) * 10) / 10;
    out.push({
      ticker,
      name,
      source: "Pons Launchpad",
      status,
      targetUSD: cap,
      seedSubscribedUSD: Math.round(cap * fillFrac),
      expectedPrice: price,
      launchAtMs: ANCHOR_MS + offsetSec * 1000,
      launchOffsetSec: offsetSec,
      fillPrice: status === "Fulfilled" ? price : undefined,
      change24hPct: status === "Fulfilled" ? change : undefined,
      note:
        status === "Announced"
          ? "Bonding curve 96% · graduation imminent"
          : status === "Subscribing"
          ? "72h post-graduation window"
          : undefined,
    });
  });

  DIRECT_ISSUERS.forEach(([ticker, name, source, note], i) => {
    const target = Math.round(between(3, 25)) * 1_000_000;
    const filled = between(0.05, 0.7);
    const offsetSec = Math.round(between(5, 180)) * 86_400;
    out.push({
      ticker,
      name,
      source,
      status: i < 4 ? "Subscribing" : "Announced",
      targetUSD: target,
      seedSubscribedUSD: Math.round(target * filled),
      expectedPrice: Math.round(between(20, 200) * 100) / 100,
      launchAtMs: ANCHOR_MS + offsetSec * 1000,
      launchOffsetSec: offsetSec,
      note,
    });
  });

  return out;
}

export const IPO_SEEDS: IPOSeed[] = buildIPOs();

export const ALL_ACTIVE = IPO_SEEDS.filter(
  (x) => x.status === "Subscribing" || x.status === "Announced"
);
export const ALL_LIVE = IPO_SEEDS.filter((x) => x.status === "Subscribing");
export const ALL_FULFILLED = IPO_SEEDS.filter(
  (x) => x.status === "Fulfilled"
);

export const BY_SOURCE = (src: Source | "All") =>
  src === "All" ? IPO_SEEDS : IPO_SEEDS.filter((x) => x.source === src);

export const LIVE_BY_SOURCE: Record<Source, number> = {
  "RHJ Reg-S": ALL_LIVE.filter((x) => x.source === "RHJ Reg-S").length,
  "Aftermarket": ALL_LIVE.filter((x) => x.source === "Aftermarket").length,
  "Pons Launchpad": ALL_LIVE.filter((x) => x.source === "Pons Launchpad")
    .length,
  "Direct Reg-S": ALL_LIVE.filter((x) => x.source === "Direct Reg-S").length,
  "Reg-A+": ALL_LIVE.filter((x) => x.source === "Reg-A+").length,
};

export const TOTAL_LIVE = ALL_LIVE.length;
export const TOTAL_VAULTS = IPO_SEEDS.length;

function buildActivity(): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const activePool = ALL_LIVE.length > 0 ? ALL_LIVE : IPO_SEEDS;
  const shortAddr = () => {
    const chars = "0123456789abcdef";
    let a = "0x";
    for (let i = 0; i < 4; i++) a += chars[Math.floor(rand() * 16)];
    a += "…";
    for (let i = 0; i < 4; i++) a += chars[Math.floor(rand() * 16)];
    return a;
  };
  for (let i = 0; i < 60; i++) {
    const ipo = activePool[Math.floor(rand() * activePool.length)];
    events.push({
      ticker: ipo.ticker,
      amountUSDG: Math.round(between(50, 8_000)),
      wallet: shortAddr(),
      boost: Math.round(between(1, 3) * 100) / 100,
      agoSec: Math.round(between(2, 3600)),
    });
  }
  return events.sort((a, b) => a.agoSec - b.agoSec);
}

export const ACTIVITY_FEED = buildActivity();

export const PIPELINE: PipelineItem[] = [
  { ticker: "STARK", name: "Starknet Foundation (secondary)", source: "Direct Reg-S", etaDays: 14, targetUSD: 6_000_000, note: "Cayman SPV underwriting" },
  { ticker: "APTOS", name: "Aptos Labs (secondary)", source: "Direct Reg-S", etaDays: 21, targetUSD: 8_000_000, note: "Legal review in progress" },
  { ticker: "MICR", name: "Micron Foundation (Reg-A+)", source: "Reg-A+", etaDays: 60, targetUSD: 15_000_000, note: "SEC Tier 2 qualification pending" },
  { ticker: "BOSAI", name: "Bosai Robotics (Grants)", source: "Grants", etaDays: 45, targetUSD: 2_000_000, note: "$85k legal underwriting approved" },
  { ticker: "MOON2", name: "Moonshot 2.0 (Pons)", source: "Pons Launchpad", etaDays: 3, targetUSD: 500_000, note: "Bonding curve 71% · trending" },
  { ticker: "GENE", name: "Genesis AI (Reg-D 506c)", source: "Direct Reg-S", etaDays: 10, targetUSD: 4_500_000, note: "Accredited-only via SBT" },
];

export function findIPO(ticker: string): IPOSeed | undefined {
  return IPO_SEEDS.find(
    (s) => s.ticker.toLowerCase() === ticker.toLowerCase()
  );
}
