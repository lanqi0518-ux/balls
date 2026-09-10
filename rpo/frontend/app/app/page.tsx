import {
  readAllStockSnapshots,
  readNetworkStatus,
} from "@/lib/robinhood/reads";
import { AppHomeClient } from "./AppHomeClient";

// Revalidate every 60s so Chainlink marks stay current without hammering
// the RPC on every request.
export const revalidate = 60;

export default async function AppHomePage() {
  const [snapshots, net] = await Promise.all([
    readAllStockSnapshots(),
    readNetworkStatus(),
  ]);
  return (
    <AppHomeClient
      underlyings={snapshots}
      chainBlockNumber={net.blockNumber != null ? Number(net.blockNumber) : null}
    />
  );
}
