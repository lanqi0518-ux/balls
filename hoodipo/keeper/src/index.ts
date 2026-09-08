import "dotenv/config";
import { fetchAssets, diffAssets, type StockAsset } from "./rhApi.js";
import { makeClients, markLaunched, getIPO } from "./registry.js";

const {
  RH_RPC_URL,
  CHAIN_ID,
  REGISTRY_ADDRESS,
  KEEPER_PRIVATE_KEY,
  POLL_INTERVAL_MS,
  WEBHOOK_URL,
} = process.env;

if (!RH_RPC_URL || !CHAIN_ID || !REGISTRY_ADDRESS || !KEEPER_PRIVATE_KEY) {
  throw new Error(
    "Missing env: RH_RPC_URL, CHAIN_ID, REGISTRY_ADDRESS, KEEPER_PRIVATE_KEY"
  );
}

const chainId = Number(CHAIN_ID);
const pollMs = Number(POLL_INTERVAL_MS ?? 30_000);
const clients = makeClients(
  RH_RPC_URL,
  chainId,
  KEEPER_PRIVATE_KEY as `0x${string}`
);

let previousSnapshot: StockAsset[] = [];

async function tick() {
  try {
    const current = await fetchAssets(chainId);

    if (previousSnapshot.length === 0) {
      // First run: seed baseline, don't fire launches for existing tokens.
      previousSnapshot = current;
      console.log(`[bootstrap] cached ${current.length} existing assets`);
      return;
    }

    const newAssets = diffAssets(previousSnapshot, current);
    previousSnapshot = current;

    if (newAssets.length === 0) return;

    console.log(`[detect] ${newAssets.length} new asset(s):`, newAssets.map(a => a.tokenSymbol));

    for (const asset of newAssets) {
      const deployment = asset.deployments.find((d) => d.chainId === chainId);
      if (!deployment) continue;

      // Check if we have an announced vault for this ticker.
      try {
        const ipo = await getIPO(clients, REGISTRY_ADDRESS as `0x${string}`, asset.tokenSymbol);
        if (ipo.status !== 1) {
          console.log(`[skip] ${asset.tokenSymbol}: no ANNOUNCED vault (status=${ipo.status})`);
          continue;
        }
        console.log(`[fire] markLaunched(${asset.tokenSymbol}, ${deployment.contractAddress})`);
        const tx = await markLaunched(
          clients,
          REGISTRY_ADDRESS as `0x${string}`,
          asset.tokenSymbol,
          deployment.contractAddress as `0x${string}`
        );
        console.log(`[tx] ${tx}`);
        await notify(`✅ Fulfilled ${asset.tokenSymbol} @ ${deployment.contractAddress} → ${tx}`);
      } catch (err) {
        console.error(`[error] ${asset.tokenSymbol}:`, err);
        await notify(`❌ Failed ${asset.tokenSymbol}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    console.error("[tick error]", err);
  }
}

async function notify(msg: string) {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: msg }),
    });
  } catch (err) {
    console.error("[webhook]", err);
  }
}

console.log(`[keeper] starting, polling every ${pollMs}ms`);
tick();
setInterval(tick, pollMs);
