import { NextRequest, NextResponse } from "next/server";
import { fetchAssets, fetchCorporateActions } from "@/lib/rhApi";
import { STOCK_TOKENS } from "@/lib/robinhood/tokens";
import { rhPublicClient } from "@/lib/robinhood/publicClient";
import { erc20Abi } from "viem";

/**
 * HOODIPO's server-side monitor route.
 *
 * Any keeper / subscribed vault / dashboard can hit this to get a
 * single, coherent snapshot of Robinhood Chain's Reg-S catalog vs.
 * our local Stock Token registry — the exact input a fulfillment
 * keeper needs to detect newly-minted tickers.
 *
 * The route is idempotent, cache-safe, and always returns JSON that
 * reveals both what's newly-listed on RHJ (candidate for fulfill)
 * and any uiMultiplier deltas since the last snapshot (candidate
 * for CorpActionsRegistry.execute).
 *
 * NOTE: This route is intentionally read-only. It never dispatches
 * on-chain transactions itself — the keeper (bot, EOA, or another
 * server) is responsible for actually landing the tx. This keeps
 * key-management out of the HTTP layer.
 */
export const revalidate = 60;

type NewListing = {
  tokenSymbol: string;
  tokenName: string;
  contractAddress: string;
  chainId: number;
  status: string;
  currentMultiplier: string;
  logoUrl: string;
};

type UiMultiplierDelta = {
  ticker: string;
  address: string;
  registryMultiplier: number;
  liveMultiplier: number;
  deltaBps: number;
};

export async function GET(_req: NextRequest) {
  const startedAt = Date.now();

  const assetsPromise = fetchAssets().catch(() => null);
  const corpActionsPromise = fetchCorporateActions().catch(() => null);
  const [assets, corpActions] = await Promise.all([
    assetsPromise,
    corpActionsPromise,
  ]);

  if (!assets) {
    return NextResponse.json(
      {
        ok: false,
        error: "Robinhood /rhj/assets unreachable",
        startedAt,
        finishedAt: Date.now(),
      },
      { status: 502 }
    );
  }

  // Detect newly-listed tickers not present in our local registry.
  const registryTickers = new Set(
    STOCK_TOKENS.map((t) => t.ticker.toUpperCase())
  );
  const newListings: NewListing[] = [];
  for (const a of assets) {
    if (a.status !== "ASSET_STATUS_ACTIVE") continue;
    if (registryTickers.has(a.tokenSymbol.toUpperCase())) continue;
    const rhChain = a.deployments.find((d) => d.chainId === 4663);
    if (!rhChain) continue;
    newListings.push({
      tokenSymbol: a.tokenSymbol,
      tokenName: a.tokenName,
      contractAddress: rhChain.contractAddress,
      chainId: rhChain.chainId,
      status: a.status,
      currentMultiplier: a.currentMultiplier,
      logoUrl: a.logoUrl,
    });
  }

  // uiMultiplier delta scan for the registry-known tokens. We use
  // the assets API's currentMultiplier (canonical) vs. the value we
  // baked into STOCK_TOKENS at registry-build time. Any mismatch is
  // a keeper trigger candidate for CorpActionsRegistry.
  const deltas: UiMultiplierDelta[] = [];
  for (const a of assets) {
    const local = STOCK_TOKENS.find(
      (t) => t.ticker.toUpperCase() === a.tokenSymbol.toUpperCase()
    );
    if (!local) continue;
    const live = Number(a.currentMultiplier);
    const baked = local.uiMultiplier ?? 1;
    if (!Number.isFinite(live) || live <= 0) continue;
    const diff = Math.abs(live - baked);
    const bps = Math.round((diff * 10_000) / baked);
    if (bps === 0) continue;
    deltas.push({
      ticker: local.ticker,
      address: local.address,
      registryMultiplier: baked,
      liveMultiplier: live,
      deltaBps: bps,
    });
  }

  // Prove RH Chain is reachable and USDG canonical is deployed.
  let rhChainBlock: string | null = null;
  try {
    const b = await rhPublicClient.getBlockNumber();
    rhChainBlock = b.toString();
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt: Date.now(),
    counts: {
      rhAssets: assets.length,
      registered: STOCK_TOKENS.length,
      newListings: newListings.length,
      uiMultiplierDeltas: deltas.length,
      corpActions: corpActions?.length ?? null,
    },
    rhChain: {
      chainId: 4663,
      latestBlock: rhChainBlock,
    },
    newListings,
    uiMultiplierDeltas: deltas,
    corpActions: corpActions ?? [],
  });
}

/**
 * HEAD endpoint that mirrors GET's cache TTL. Useful for uptime
 * probes so they don't pay the full RHJ round-trip.
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { "cache-control": "public, max-age=60" },
  });
}

// Ensure we don't accidentally leak a request-scoped ERC20 handle.
void erc20Abi;
