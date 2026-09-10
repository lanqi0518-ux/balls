"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  okxWallet,
  rabbyWallet,
  rainbowWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { http, createConfig } from "wagmi";
import { arbitrum, arbitrumSepolia, base, mainnet } from "wagmi/chains";
import { robinhoodChain } from "./chain";

/**
 * wagmi + RainbowKit config.
 *
 * Robinhood Chain is the primary chain. Arbitrum Sepolia is included so
 * pre-mainnet dry runs work end-to-end with real wallets. Ethereum /
 * Arbitrum / Base are registered for cross-chain USDC/ETH balance sensing.
 *
 * ────────────────────────────────────────────────────────────────
 * WalletConnect handling:
 *
 * Injected wallets (MetaMask, Rabby, OKX, Trust, Rainbow, Brave, Coinbase
 * Wallet extension) and Coinbase Wallet SDK do NOT require a real
 * WalletConnect Cloud projectId — they connect over their own transports.
 * The WalletConnect wallet is only listed when a real projectId is set
 * via NEXT_PUBLIC_WC_PROJECT_ID, so we never ship a broken WC QR to
 * production. Without a projectId, users on desktop or in an in-wallet
 * browser can still connect — they just don't get the WC QR fallback.
 * ────────────────────────────────────────────────────────────────
 */

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
const WC_ENABLED =
  typeof WC_PROJECT_ID === "string" &&
  WC_PROJECT_ID.length > 8 &&
  WC_PROJECT_ID !== "rpo-demo-project";

const popularWallets = [
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  coinbaseWallet,
  okxWallet,
  rainbowWallet,
  trustWallet,
  ...(WC_ENABLED ? [walletConnectWallet] : []),
];

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: popularWallets,
    },
  ],
  {
    appName: "RPO — permissionless IPO subscription",
    // RainbowKit still requires this field even if WC is disabled —
    // passing a string keeps it happy without registering the WC provider.
    projectId: WC_PROJECT_ID ?? "wc-disabled",
    appDescription:
      "Buy tokenized IPOs on Robinhood Chain. No broker, no KYC.",
    appUrl: "https://rpo-web.fly.dev",
  }
);

export const wagmiConfig = createConfig({
  chains: [robinhoodChain, arbitrumSepolia, mainnet, arbitrum, base],
  connectors,
  transports: {
    [robinhoodChain.id]: http(),
    [arbitrumSepolia.id]: http(),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
  },
  ssr: true,
});
