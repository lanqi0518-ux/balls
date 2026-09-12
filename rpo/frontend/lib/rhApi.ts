/**
 * Thin client for Robinhood's public REST APIs. All endpoints are rate-limited
 * to 60 req/s and cached; we always fetch from server-side (route handlers)
 * so browser calls don't leak the origin.
 *
 * Docs: https://docs.robinhood.com/chain/stock-token-apis/
 */

const BASE = "https://api.robinhood.com/rhj";

export type StockAsset = {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  currentMultiplier: string;
  pendingMultiplier: string;
  pendingMultiplierEffectiveTime?: string;
  logoUrl: string;
  status: "ASSET_STATUS_ACTIVE" | "ASSET_STATUS_INACTIVE" | "ASSET_STATUS_UNSPECIFIED";
  deployments: Array<{ contractAddress: string; chainId: number }>;
};

export type StockQuote = {
  tokenSymbol: string;
  bid: string;
  ask: string;
  currency: string;
  dailyTradingVolume: string;
  isTradingHalt: boolean;
  generatedAt: string;
};

export async function fetchAssets(): Promise<StockAsset[]> {
  const res = await fetch(`${BASE}/assets`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`RH /assets ${res.status}`);
  const json = (await res.json()) as { assets: StockAsset[] };
  return json.assets;
}

export async function fetchQuote(symbol: string): Promise<StockQuote | null> {
  const res = await fetch(`${BASE}/prices/${symbol}`, {
    next: { revalidate: 15 },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { quotes: StockQuote[] };
  return json.quotes[0] ?? null;
}

export type CorporateAction = {
  id: string;
  type: string;
  status: string;
  processDate?: { year: number; month: number; day: number };
  tokenSymbol: string;
  details: Record<string, unknown>;
};

export async function fetchCorporateActions(): Promise<CorporateAction[]> {
  const res = await fetch(`${BASE}/corporate-actions`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`RH /corporate-actions ${res.status}`);
  const json = (await res.json()) as { corpActions: CorporateAction[] };
  return json.corpActions;
}
