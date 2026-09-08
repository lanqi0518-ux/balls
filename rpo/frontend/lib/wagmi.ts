"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { robinhoodChain } from "./chain";
import { arbitrum, base, mainnet } from "wagmi/chains";
import { http } from "wagmi";

/**
 * wagmi + RainbowKit config.
 *
 * Robinhood Chain is the primary chain; we also register Ethereum, Arbitrum,
 * and Base so wallets that hold USDC/ETH on those chains can be sensed for
 * cross-chain bridging via LiFi.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "RPO — permissionless IPO subscription",
  appDescription:
    "Subscribe to real IPOs on-chain. Built on Robinhood Chain.",
  appUrl: "https://rpo.xyz",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "rpo-demo-project",
  chains: [robinhoodChain, mainnet, arbitrum, base],
  transports: {
    [robinhoodChain.id]: http(),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
  },
  ssr: true,
});
