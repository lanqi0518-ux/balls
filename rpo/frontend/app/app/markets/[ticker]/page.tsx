import { notFound } from "next/navigation";
import { findStockToken } from "@/lib/robinhood/tokens";
import { readAllStockSnapshots } from "@/lib/robinhood/reads";
import { SubscribeClient } from "./SubscribeClient";

// Revalidate every 60s so the price feed stays current.
export const revalidate = 60;

export default async function SubscribePage({
  params,
}: {
  params: { ticker: string };
}) {
  const token = findStockToken(params.ticker);
  if (!token) notFound();

  // Reuse the batched multicall reader — it picks Chainlink when
  // available and falls back to V4 pool mid otherwise.
  const snapshots = await readAllStockSnapshots();
  const snap = snapshots.find(
    (s) => s.token.ticker.toUpperCase() === token.ticker.toUpperCase()
  );

  return (
    <SubscribeClient
      token={token}
      priceUsd={snap?.priceUsd ?? null}
      totalSupply={snap?.totalSupply ?? null}
      priceUpdatedAt={snap?.updatedAt ?? null}
      priceSource={snap?.priceSource ?? "unavailable"}
    />
  );
}
