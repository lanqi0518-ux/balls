import { ReactNode } from "react";
import { Providers } from "@/app/providers";

/**
 * Route-group layout for the HOODIPO primitive pages. These pages
 * embed interactive panels (VaultHuntPanel, StrategyBuilder,
 * HedgePanel, PredictionMarketPreview) that call wagmi's `useAccount`
 * hook — that hook requires a `WagmiProvider` ancestor.
 *
 * We keep the primitive pages under this group so they get the
 * `Providers` wrapper (Wagmi + RainbowKit + TanStack Query + Sonner)
 * without paying that JS bundle cost on pure-marketing pages
 * (`/`, `/about`, `/whitepaper`, `/how-it-works`, …), which remain
 * outside the group and unaffected.
 *
 * Route-group parentheses in Next 14 App Router don't affect URL
 * shape, so users still browse to `/vault`, `/launch`, `/strategies`,
 * `/predict`, `/hedge` — no redirect needed.
 */
export default function HoodipoLayout({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
