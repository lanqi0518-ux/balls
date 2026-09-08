import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "RPO — Subscribe to Real IPOs On-Chain",
  description:
    "Zero-friction IPO subscription on Robinhood Chain. No broker. No KYC. In 20 seconds.",
  openGraph: {
    title: "RPO",
    description: "Real IPO subscription, on-chain, permissionless.",
    url: "https://rpo.xyz",
    siteName: "RPO",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-chain-bg text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
