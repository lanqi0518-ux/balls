import { defineChain } from "viem";

/**
 * Robinhood Chain (Arbitrum Orbit L2).
 * Chain ID 4663, gas token ETH.
 * See: https://docs.robinhood.com/chain/connecting/
 */
export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Robinscan", url: "https://robinscan.com" },
  },
  contracts: {},
});

export const CANONICAL = {
  USDG: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  WETH: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  UniversalRouter: "0x8876789976dEcBfCbBbe364623C63652db8C0904",
} as const;

export type HoodDeployment = {
  registry: `0x${string}`;
  booster: `0x${string}`;
  looper: `0x${string}`;
  adapter: `0x${string}`;
  ipoToken: `0x${string}`;
};

// Placeholder — fill in after deploy.
export const DEPLOYMENT: HoodDeployment = {
  registry: "0x0000000000000000000000000000000000000000",
  booster: "0x0000000000000000000000000000000000000000",
  looper: "0x0000000000000000000000000000000000000000",
  adapter: "0x0000000000000000000000000000000000000000",
  ipoToken: "0x0000000000000000000000000000000000000000",
};
