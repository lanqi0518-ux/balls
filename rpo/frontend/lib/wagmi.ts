"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { arbitrum, arbitrumSepolia, base, mainnet } from "wagmi/chains";
import { robinhoodChain } from "./chain";

/**
 * wagmi + RainbowKit config.
 *
 * Robinhood Chain is the primary chain. Arbitrum Sepolia is included so
 * pre-mainnet dry runs (contracts deployed there) work end-to-end with
 * real wallets. Ethereum / Arbitrum / Base are registered for
 * cross-chain USDC/ETH balance sensing (LiFi bridge widget).
 */
export const wagmiConfig = getDefaultConfig({
  appName: "RPO — permissionless IPO subscription",
  appDescription:
    "Subscribe to real IPOs on-chain. Built on Robinhood Chain.",
  appUrl: "https://rpo.xyz",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "rpo-demo-project",
  chains: [robinhoodChain, arbitrumSepolia, mainnet, arbitrum, base],
  transports: {
    [robinhoodChain.id]: http(),
    [arbitrumSepolia.id]: http(),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
  },
  ssr: true,
});
