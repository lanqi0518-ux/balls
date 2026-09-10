import { notFound } from "next/navigation";
import { findStockToken } from "@/lib/robinhood/tokens";
import { rhPublicClient } from "@/lib/robinhood/publicClient";
import { erc20Abi } from "viem";
import { SubscribeClient } from "./SubscribeClient";

// Revalidate every 60s so the price feed stays current.
export const revalidate = 60;

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

export default async function SubscribePage({
  params,
}: {
  params: { ticker: string };
}) {
  const token = findStockToken(params.ticker);
  if (!token) notFound();

  // Fetch real Chainlink price + on-chain supply in one round trip.
  let priceUsd: number | null = null;
  let updatedAt: number | null = null;
  let totalSupply: number | null = null;

  try {
    const results = await rhPublicClient.multicall({
      contracts: [
        {
          address: token.priceFeed,
          abi: CHAINLINK_ABI,
          functionName: "latestRoundData",
        },
        {
          address: token.priceFeed,
          abi: CHAINLINK_ABI,
          functionName: "decimals",
        },
        {
          address: token.address,
          abi: erc20Abi,
          functionName: "totalSupply",
        },
      ],
      allowFailure: true,
    });

    const round = results[0];
    const decRes = results[1];
    const supplyRes = results[2];

    if (
      round.status === "success" &&
      decRes.status === "success" &&
      Array.isArray(round.result) &&
      round.result.length >= 4
    ) {
      const answer = round.result[1] as bigint;
      const updated = round.result[3] as bigint;
      const dec = decRes.result as number;
      priceUsd = Number(answer) / 10 ** dec;
      updatedAt = Number(updated);
    }
    if (supplyRes.status === "success") {
      totalSupply =
        Number(supplyRes.result as bigint) / 10 ** token.decimals;
    }
  } catch (err) {
    console.warn(
      "[rh-chain] /app/markets/%s: RPC read failed",
      token.ticker,
      err
    );
  }

  return (
    <SubscribeClient
      token={token}
      priceUsd={priceUsd}
      totalSupply={totalSupply}
      priceUpdatedAt={updatedAt}
    />
  );
}
