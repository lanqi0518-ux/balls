/**
 * Server-safe on-chain readers for Robinhood Chain. Callable from
 * Server Components / route handlers. Every function hits the live
 * RPC — nothing is faked or cached beyond the tiny in-memory
 * response the ISR layer already provides.
 *
 * The read layer is intentionally minimal:
 *  - `readAllStockSnapshots()` — every token in the registry, in one
 *    multicall round-trip. For tokens with a Chainlink feed we use
 *    the feed; otherwise we read the V4 pool slot0 via extsload and
 *    compute the pool mid, which tracks the underlying to within a
 *    few bps via arbitrage.
 *  - `readNetworkStatus()` — block number + USDG supply (proof that
 *    Robinhood Chain is live and canonical USDG is deployed).
 *
 * When the RPC fails, snapshots are returned with `null` price / supply
 * fields so callers can render an honest "unavailable" state rather
 * than fake numbers.
 */

import { cache } from "react";
import { encodeAbiParameters, erc20Abi, keccak256, parseAbiParameters } from "viem";
import { rhPublicClient } from "./publicClient";
import { RH_INFRA, STOCK_TOKENS, type StockToken } from "./tokens";
import {
  V4_POOLS,
  V4_POOL_MANAGER,
  POOL_MANAGER_ABI,
  decodeSlot0,
  midPriceUsdgPerStock,
} from "./v4";

/** Chainlink AggregatorV3Interface — the four functions we actually need. */
const CHAINLINK_ABI = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

export type StockSnapshot = {
  token: StockToken;
  /** USD reference mark. From Chainlink when configured; else pool mid. `null` on RPC failure. */
  priceUsd: number | null;
  /** UNIX seconds — when Chainlink last updated the feed. `null` for pool-mid quotes. */
  updatedAt: number | null;
  /** ERC-20 totalSupply as a native JS number in whole tokens. `null` on failure. */
  totalSupply: number | null;
  /** Where the price came from — helps the UI label it honestly. */
  priceSource: "chainlink" | "pool-mid" | "unavailable";
};

export type NetworkStatus = {
  chainId: number;
  chainName: string;
  /** Latest block; proof the RPC is live. */
  blockNumber: bigint | null;
  /** USDG totalSupply on Robinhood Chain, in native USDG units. */
  usdgSupply: number | null;
  /** RPC endpoint we hit; useful for badges / debugging. */
  rpcUrl: string;
};

/**
 * Compute the storage slot for a V4 pool's slot0 word.
 * Pool state mapping lives at slot 6 in the PoolManager; slot0 is
 * offset 0 within each pool's state struct.
 */
function slot0Key(poolId: `0x${string}`): `0x${string}` {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("bytes32, uint256"), [poolId, 6n])
  );
}

/**
 * Read every configured stock token in one multicall round trip.
 * Returns as many snapshots as tokens are configured; entries with
 * `priceUsd === null` mean the RPC failed for that specific call.
 *
 * Wrapped in `React.cache` so that Hero + StatsBar + FeaturedIPOs
 * on the same page share a single RPC round trip during render.
 */
export const readAllStockSnapshots = cache(async function readAllStockSnapshotsImpl(): Promise<StockSnapshot[]> {
  if (STOCK_TOKENS.length === 0) return [];

  // Three parallel groups per token:
  //   [0] pool slot0 via extsload  (for pool-mid quote — always tried)
  //   [1] Chainlink latestRoundData (skipped when priceFeed is unset)
  //   [2] Chainlink decimals        (skipped when priceFeed is unset)
  //   [3] ERC-20 totalSupply
  //
  // We flatten into one multicall so the whole page gets a single RPC round trip.
  type Call = { address: `0x${string}`; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] };
  const zero = "0x0000000000000000000000000000000000000000" as const;
  const contracts: Call[] = STOCK_TOKENS.flatMap((t) => {
    const pool = V4_POOLS[t.ticker.toUpperCase() as keyof typeof V4_POOLS];
    const extsloadCall: Call = pool
      ? {
          address: V4_POOL_MANAGER,
          abi: POOL_MANAGER_ABI as readonly unknown[],
          functionName: "extsload",
          args: [slot0Key(pool.poolId)],
        }
      : {
          address: zero,
          abi: POOL_MANAGER_ABI as readonly unknown[],
          functionName: "extsload",
          args: [zero as `0x${string}`],
        };
    const chainlinkRound: Call = t.priceFeed
      ? {
          address: t.priceFeed,
          abi: CHAINLINK_ABI as readonly unknown[],
          functionName: "latestRoundData",
        }
      : {
          address: zero,
          abi: CHAINLINK_ABI as readonly unknown[],
          functionName: "latestRoundData",
        };
    const chainlinkDec: Call = t.priceFeed
      ? {
          address: t.priceFeed,
          abi: CHAINLINK_ABI as readonly unknown[],
          functionName: "decimals",
        }
      : {
          address: zero,
          abi: CHAINLINK_ABI as readonly unknown[],
          functionName: "decimals",
        };
    const supply: Call = {
      address: t.address,
      abi: erc20Abi as readonly unknown[],
      functionName: "totalSupply",
    };
    return [extsloadCall, chainlinkRound, chainlinkDec, supply];
  });

  let results: Array<{ status: "success" | "failure"; result?: unknown }>;
  try {
    results = (await rhPublicClient.multicall({
      contracts: contracts as never,
      allowFailure: true,
    })) as never;
  } catch {
    return STOCK_TOKENS.map((t) => ({
      token: t,
      priceUsd: null,
      updatedAt: null,
      totalSupply: null,
      priceSource: "unavailable" as const,
    }));
  }

  return STOCK_TOKENS.map((t, i) => {
    const slot0Res = results[i * 4];
    const roundRes = results[i * 4 + 1];
    const decRes = results[i * 4 + 2];
    const supplyRes = results[i * 4 + 3];

    let priceUsd: number | null = null;
    let updatedAt: number | null = null;
    let priceSource: StockSnapshot["priceSource"] = "unavailable";

    // Prefer Chainlink when the token has a configured feed and the call succeeded.
    if (
      t.priceFeed &&
      roundRes?.status === "success" &&
      decRes?.status === "success" &&
      Array.isArray(roundRes.result) &&
      roundRes.result.length >= 4
    ) {
      const answer = roundRes.result[1] as bigint;
      const updated = roundRes.result[3] as bigint;
      const dec = decRes.result as number;
      priceUsd = Number(answer) / 10 ** dec;
      updatedAt = Number(updated);
      priceSource = "chainlink";
    } else {
      // Fallback: read pool slot0 and compute mid.
      const pool = V4_POOLS[t.ticker.toUpperCase() as keyof typeof V4_POOLS];
      if (pool && slot0Res?.status === "success") {
        try {
          const raw = BigInt(slot0Res.result as `0x${string}`);
          if (raw !== 0n) {
            const { sqrtPriceX96 } = decodeSlot0(raw);
            if (sqrtPriceX96 > 0n) {
              const usdgPerStock = midPriceUsdgPerStock(
                sqrtPriceX96,
                pool.usdgIsCurrency0
              );
              // Apply uiMultiplier: contracts scale down raw share-equivalents
              // by uiMultiplier; the pool mid is the raw price, and the
              // ui-consistent price is raw × uiMultiplier.
              const uiMultiplier = t.uiMultiplier ?? 1;
              const p = usdgPerStock * uiMultiplier;
              if (Number.isFinite(p) && p > 0) {
                priceUsd = p;
                priceSource = "pool-mid";
              }
            }
          }
        } catch {
          // ignore — leave price null
        }
      }
    }

    let totalSupply: number | null = null;
    if (supplyRes?.status === "success") {
      totalSupply =
        Number(supplyRes.result as bigint) / 10 ** t.decimals;
    }

    return { token: t, priceUsd, updatedAt, totalSupply, priceSource };
  });
});

export const readNetworkStatus = cache(async function readNetworkStatusImpl(): Promise<NetworkStatus> {
  const chain = rhPublicClient.chain;
  const rpcUrl = chain.rpcUrls.default.http[0];
  try {
    const [block, supply] = await Promise.all([
      rhPublicClient.getBlockNumber(),
      rhPublicClient.readContract({
        address: RH_INFRA.USDG,
        abi: erc20Abi,
        functionName: "totalSupply",
      }),
    ] as const);
    return {
      chainId: chain.id,
      chainName: chain.name,
      blockNumber: block,
      usdgSupply: Number(supply as bigint) / 1e6,
      rpcUrl,
    };
  } catch {
    return {
      chainId: chain.id,
      chainName: chain.name,
      blockNumber: null,
      usdgSupply: null,
      rpcUrl,
    };
  }
});
