"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  okxWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { http, createConfig } from "wagmi";
import { arbitrum, arbitrumSepolia, base, mainnet } from "wagmi/chains";
import { robinhoodChain } from "./chain";

/**
 * wagmi + RainbowKit config.
 *
 * ────────────────────────────────────────────────────────────────
 * WalletConnect handling (fully guarded):
 *
 * Almost every wallet connector in RainbowKit v2 (MetaMask, Rabby,
 * OKX, Rainbow, Trust) uses WalletConnect as its mobile-deeplink
 * fallback. When the WalletConnect projectId is invalid, those
 * connectors initialise a WC Relay socket on page load that keeps
 * failing with `code: 1006 (Project not found)` — spamming the
 * console and stalling connect clicks with an infinite "Opening…"
 * spinner (production regression, reported 2026-09-10).
 *
 * To avoid that failure mode entirely when no real projectId is set,
 * we fall back to a wallet list that uses ONLY pure-injected paths:
 *   - injectedWallet: pure window.ethereum, no WC dependency
 *   - coinbaseWallet: uses @coinbase/wallet-sdk with its own transport
 *
 * When NEXT_PUBLIC_WC_PROJECT_ID is set to a valid Cloud project id
 * (>8 chars, not the stale "rpo-demo-project" placeholder), the full
 * wallet menu is enabled — MetaMask, Rabby, OKX, Rainbow, Trust,
 * WalletConnect QR — because those connectors work correctly.
 * ────────────────────────────────────────────────────────────────
 */

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
const WC_ENABLED =
  typeof WC_PROJECT_ID === "string" &&
  WC_PROJECT_ID.length > 8 &&
  WC_PROJECT_ID !== "rpo-demo-project";

const wallets = WC_ENABLED
  ? [
      injectedWallet,
      metaMaskWallet,
      rabbyWallet,
      coinbaseWallet,
      okxWallet,
      rainbowWallet,
      trustWallet,
      walletConnectWallet,
    ]
  : [injectedWallet, coinbaseWallet];

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets,
    },
  ],
  {
    appName: "RPO — permissionless IPO subscription",
    // RainbowKit demands a projectId string even when we've stripped
    // every WC-backed wallet from the list. This placeholder is only
    // used by dead code paths in that case.
    projectId: WC_ENABLED ? WC_PROJECT_ID! : "wc-disabled-see-lib-wagmi-ts",
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

/** True when the deployment has a real WalletConnect projectId; used
 * by the UI to show/hide the "mobile wallet" hint. */
export const walletConnectEnabled = WC_ENABLED;
