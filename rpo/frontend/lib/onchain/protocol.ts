"use client";

/**
 * Top-level hook that describes the *state of the protocol* on the
 * currently-selected chain. Consumed by NetworkStatus, /app/stake,
 * /app/ipo/[ticker], /faucet, etc.
 *
 * Design goal: every screen makes exactly one decision — "is the
 * protocol live on this chain, or is it still pending deployment?"
 * When it's pending, we render a Waitlist / Testnet-Switcher CTA
 * instead of fake balances. When it's live, every hook below reads
 * *real* onchain state.
 */

import {
  CONTRACTS,
  IS_TESTNET,
  PROTOCOL_LIVE,
  activeChain,
  isDeployed,
} from "@/lib/chain";

export type ProtocolState = {
  chainId: number;
  chainName: string;
  isTestnet: boolean;
  isLive: boolean; // full protocol deployed on the active chain
  contracts: typeof CONTRACTS;
  missing: Array<keyof typeof CONTRACTS>; // which addresses are still zero
};

export function useProtocol(): ProtocolState {
  const missing: Array<keyof typeof CONTRACTS> = [];
  (Object.keys(CONTRACTS) as Array<keyof typeof CONTRACTS>).forEach((k) => {
    if (!isDeployed(CONTRACTS[k])) missing.push(k);
  });

  return {
    chainId: activeChain.id,
    chainName: activeChain.name,
    isTestnet: IS_TESTNET,
    isLive: PROTOCOL_LIVE,
    contracts: CONTRACTS,
    missing,
  };
}
