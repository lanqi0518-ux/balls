/**
 * Thin wrapper around Robinhood's public REST APIs used by the keeper.
 *
 * Docs: https://docs.robinhood.com/chain/stock-token-apis/
 * Rate limits: 60 req/s, cached (15s for /prices, 60s for /assets).
 */

export type StockAsset = {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  currentMultiplier: string;
  status: "ASSET_STATUS_ACTIVE" | "ASSET_STATUS_INACTIVE" | "ASSET_STATUS_UNSPECIFIED";
  deployments: Array<{ contractAddress: string; chainId: number }>;
};

const BASE = "https://api.robinhood.com/rhj";

export async function fetchAssets(chainId: number): Promise<StockAsset[]> {
  const res = await fetch(`${BASE}/assets`, {
    headers: { "User-Agent": "rpo-keeper/0.1" },
  });
  if (!res.ok) throw new Error(`RH /assets HTTP ${res.status}`);
  const json = (await res.json()) as { assets: StockAsset[] };
  return json.assets.filter((a) =>
    a.deployments.some((d) => d.chainId === chainId)
  );
}

/**
 * Diff two snapshots and return assets that appeared in `curr` but were
 * missing in `prev`. This is our "new IPO detected!" trigger.
 */
export function diffAssets(prev: StockAsset[], curr: StockAsset[]): StockAsset[] {
  const prevSymbols = new Set(prev.map((a) => a.tokenSymbol));
  return curr.filter(
    (a) => !prevSymbols.has(a.tokenSymbol) && a.status === "ASSET_STATUS_ACTIVE"
  );
}
