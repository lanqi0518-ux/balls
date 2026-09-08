import "./globals.css";
import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rpo.xyz"),
  title: {
    default: "RPO — The permissionless IPO subscription protocol",
    template: "%s · RPO",
  },
  description:
    "Subscribe to real IPOs on-chain. No broker. No KYC. In 20 seconds. Built on Robinhood Chain, priced through Rialto propAMM, boosted by $RPO.",
  keywords: [
    "RPO",
    "IPO",
    "Robinhood Chain",
    "Stock Tokens",
    "Rialto propAMM",
    "on-chain IPO",
    "tokenized equities",
  ],
  openGraph: {
    title: "RPO — The permissionless IPO subscription protocol",
    description: "Real IPO subscription, on-chain, permissionless.",
    url: "https://rpo.xyz",
    siteName: "RPO",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "RPO — Subscribe to Real IPOs On-Chain",
    creator: "@rpo_xyz",
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
      className={`${inter.variable} ${serif.variable} ${mono.variable}`}
    >
      <body className="min-h-screen bg-ink-900 text-fg antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
