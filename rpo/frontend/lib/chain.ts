import { defineChain } from "viem";
import { arbitrumSepolia } from "wagmi/chains";

/**
 * Robinhood Chain (Arbitrum Orbit L2). Chain ID 4663, gas token ETH.
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

/** Canonical mainnet USDG on Robinhood Chain (published by RHJ). */
export const CANONICAL_USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
export const CANONICAL_WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
export const CANONICAL_UNIVERSAL_ROUTER =
  "0x8876789976dEcBfCbBbe364623C63652db8C0904";

/**
 * The chain the app should read/write against. Defaults to Robinhood Chain
 * mainnet; can be pinned to Arbitrum Sepolia for testnet dry runs by setting
 * NEXT_PUBLIC_CHAIN_ID=421614.
 */
const configuredChainId = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? robinhoodChain.id
);

export const activeChain =
  configuredChainId === arbitrumSepolia.id
    ? arbitrumSepolia
    : robinhoodChain;

/**
 * Contract addresses. Populated from env vars — empty defaults are the
 * zero address, which every hook treats as "not deployed on this chain
 * yet". When the user launches $RPO on Pons and deploys the protocol,
 * they set these vars in `.env.local` / Fly secrets and the UI wires
 * itself up automatically. Zero code changes required.
 */
export const CONTRACTS = {
  usdg: (process.env.NEXT_PUBLIC_USDG_ADDRESS ??
    (configuredChainId === robinhoodChain.id ? CANONICAL_USDG : "0x0000000000000000000000000000000000000000")) as `0x${string}`,
  rpo: (process.env.NEXT_PUBLIC_RPO_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  booster: (process.env.NEXT_PUBLIC_BOOSTER_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  registry: (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  discovery: (process.env.NEXT_PUBLIC_DISCOVERY_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  faucet: (process.env.NEXT_PUBLIC_FAUCET_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
} as const;

export function isDeployed(addr: `0x${string}`): boolean {
  return addr !== "0x0000000000000000000000000000000000000000";
}

/** True if the protocol has been deployed to whatever chain the app targets. */
export const PROTOCOL_LIVE =
  isDeployed(CONTRACTS.rpo) &&
  isDeployed(CONTRACTS.booster) &&
  isDeployed(CONTRACTS.registry);

/** Convenience: are we on a testnet? */
export const IS_TESTNET = configuredChainId === arbitrumSepolia.id;

/** Block explorer URL for a given tx hash. */
export function explorerTx(hash: string): string {
  const base =
    activeChain.blockExplorers?.default.url ?? "https://etherscan.io";
  return `${base}/tx/${hash}`;
}
