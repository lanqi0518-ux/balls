/**
 * Server-safe on-chain readers for Robinhood Chain. Callable from
 * Server Components / route handlers. Every function hits the live
 * RPC — nothing is faked or cached beyond the tiny in-memory
 * response the ISR layer already provides.
 *
 * The read layer is intentionally minimal:
 *  - `readStockSnapshot(t)`  — one token's live price + supply
 *  - `readAllStockSnapshots()` — every token in the registry, in
 *    one multicall round-trip
 *  - `readNetworkStatus()` — block number + USDG supply (proof
 *    Robinhood Chain is live and canonical USDG is deployed)
 *
 * When the RPC fails, snapshots are returned with `null` price / supply
 * fields so callers can render an honest "unavailable" state rather
 * than fake numbers.
 */

import { cache } from "react";
import { erc20Abi } from "viem";
import { rhPublicClient } from "./publicClient";
import { RH_INFRA, STOCK_TOKENS, type StockToken } from "./tokens";

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
  /** Live Chainlink mark, USD. `null` when the RPC failed. */
  priceUsd: number | null;
  /** UNIX seconds — when Chainlink last updated the feed. `null` on failure. */
  updatedAt: number | null;
  /** ERC-20 totalSupply as a native JS number in whole tokens. `null` on failure. */
  totalSupply: number | null;
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
 * Read every configured stock token in one multicall round trip.
 * Returns as many snapshots as tokens are configured; entries with
 * `priceUsd === null` mean the RPC failed for that specific call.
 *
 * Wrapped in `React.cache` so that Hero + StatsBar + FeaturedIPOs
 * on the same page share a single RPC round trip during render.
 */
export const readAllStockSnapshots = cache(async function readAllStockSnapshotsImpl(): Promise<StockSnapshot[]> {
  if (STOCK_TOKENS.length === 0) return [];

  const contracts = STOCK_TOKENS.flatMap((t) => [
    {
      address: t.priceFeed,
      abi: CHAINLINK_ABI,
      functionName: "latestRoundData" as const,
    },
    {
      address: t.priceFeed,
      abi: CHAINLINK_ABI,
      functionName: "decimals" as const,
    },
    {
      address: t.address,
      abi: erc20Abi,
      functionName: "totalSupply" as const,
    },
  ]);

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
    }));
  }

  return STOCK_TOKENS.map((t, i) => {
    const roundResult = results[i * 3];
    const decimalsResult = results[i * 3 + 1];
    const supplyResult = results[i * 3 + 2];

    let priceUsd: number | null = null;
    let updatedAt: number | null = null;

    if (
      roundResult.status === "success" &&
      decimalsResult.status === "success" &&
      Array.isArray(roundResult.result) &&
      roundResult.result.length >= 4
    ) {
      const answer = roundResult.result[1] as bigint;
      const updated = roundResult.result[3] as bigint;
      const dec = decimalsResult.result as number;
      priceUsd = Number(answer) / 10 ** dec;
      updatedAt = Number(updated);
    }

    let totalSupply: number | null = null;
    if (supplyResult.status === "success") {
      totalSupply =
        Number(supplyResult.result as bigint) / 10 ** t.decimals;
    }

    return { token: t, priceUsd, updatedAt, totalSupply };
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
    // USDG on Robinhood Chain is 6-decimal (Global Dollar standard,
    // verified by eth_call decimals() → 0x06).
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
