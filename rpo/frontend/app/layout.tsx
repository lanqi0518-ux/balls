import "./globals.css";
import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import { JsonLd } from "@/components/seo/JsonLd";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rpo.xyz"),
  title: {
    default: "HOODIPO — The primary-market layer for Robinhood Chain",
    template: "%s · HOODIPO",
  },
  description:
    "Five permissionless primitives that turn Robinhood Chain into a full primary-market venue: pre-mint subscription vaults, anti-MEV V4 launch hooks, programmable uiMultiplier corporate actions, physical-delivery IPO prediction markets, and lockup-event hedging.",
  keywords: [
    "HOODIPO",
    "RPO",
    "IPO",
    "Robinhood Chain",
    "Stock Tokens",
    "Uniswap V4 hook",
    "ERC-8056",
    "uiMultiplier",
    "on-chain IPO",
    "tokenized equities",
    "PreMintVault",
    "physical settlement",
  ],
  openGraph: {
    title: "HOODIPO — The primary-market layer for Robinhood Chain",
    description:
      "Pre-mint vaults, anti-snipe V4 hooks, programmable corp actions, physical-delivery IPO markets, lockup hedging. Five primitives. Zero admins.",
    url: "https://rpo.xyz",
    siteName: "HOODIPO",
    type: "website",
    locale: "en_US",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${mono.variable}`}
    >
      <head>
        <JsonLd />
      </head>
      <body className="min-h-screen bg-white text-ink-900 antialiased">
        {children}
      </body>
    </html>
  );
}
