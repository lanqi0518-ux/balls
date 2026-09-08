import "./globals.css";
import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
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
      className={`${inter.variable} ${fraunces.variable} ${mono.variable}`}
    >
      <head>
        <link
          rel="alternate"
          type="application/rss+xml"
          title="RPO Blog"
          href="/blog/rss.xml"
        />
        <JsonLd />
      </head>
      <body className="min-h-screen bg-white text-ink-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
