import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Section, SectionHeader } from "@/components/ui/Section";
import { PrimitiveDeployBanner } from "@/components/hoodipo/PrimitiveDeployBanner";
import { PredictionMarketPreview } from "@/components/hoodipo/PredictionMarketPreview";
import { CONTRACTS } from "@/lib/chain";
import { Check, ArrowUpRight } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "Physical-delivery IPO markets · PhysicalPredictionMarket",
  description:
    "HOODIPO's primitive 04. Bet USDG on whether Robinhood mints a specific ticker before a deadline. YES holders redeem for actual d-TICKER; NO holders redeem for USDG 1:1. Nobody else on Robinhood Chain settles physical.",
};

export const dynamic = "force-dynamic";

const CANDIDATE_MARKETS = [
  {
    ticker: "STRIPE",
    company: "Stripe, Inc.",
    deadline: "2026-12-31",
    thesis:
      "Stripe re-filed S-1 in Q3 2025 rumours; Reg-S carve-out lets RHJ mint before US listing.",
  },
  {
    ticker: "DBRX",
    company: "Databricks",
    deadline: "2026-09-30",
    thesis:
      "Data lakehouse leader; Series-J at $62B; multiple IPO pushes deferred but shelf-registration flagged.",
  },
  {
    ticker: "XAI",
    company: "xAI Corp.",
    deadline: "2027-06-30",
    thesis:
      "Post-Grok-4 valuation; direct-listing rumours; RHJ's OpenAI/Anthropic pre-IPO precedent implies feasibility.",
  },
  {
    ticker: "ANTHROPIC",
    company: "Anthropic PBC",
    deadline: "2027-12-31",
    thesis:
      "Robinhood already offers a pre-IPO Anthropic-linked token; a public listing would let PredictionMarket resolve physically.",
  },
];

const INVARIANTS = [
  "resolveYes requires a valid RHJ signature over (ticker, stockToken, chainId). Bogus tokens can't flip the market.",
  "resolveNo is permissionless after deadline. Nobody at HOODIPO can withhold NO settlement.",
  "YES payout is physical: the full USDG pot (minus platform fee) routes through UniversalRouter into real d-TICKER, distributed pro-rata to YES holders.",
  "NO payout is USDG 1:1 of your NO stake — no house edge on the losing side beyond the 2% platform fee taken at resolve.",
  "Every bet call transfers USDG immediately; there is no order-book, no maker/taker, no matcher — the market is a pure two-sided lottery.",
];

export default function PredictPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Primitive 04 · PhysicalPredictionMarket"
        title={
          <>
            Bet on{" "}
            <span className="italic text-forest-500">whether</span> the token
            lists — and be paid <span className="italic text-forest-500">in the token itself</span>.
          </>
        }
        description="Polymarket and Kalshi settle IPO markets in cash. HOODIPO settles physically: if you bet YES and the market resolves YES, you receive real d-TICKER (not USDC). No other primitive on Robinhood Chain offers this because no other protocol has both attestation-verified resolution and a UniversalRouter buy leg in one contract."
      />

      <Section>
        <PrimitiveDeployBanner
          primitive="PhysicalPredictionMarket · Primitive 04 (per-market deployment)"
          address={"0x0000000000000000000000000000000000000000" as `0x${string}`}
          githubPath="https://github.com/lanqi0518-ux/hoodipo/blob/main/rpo/contracts/src/hoodipo/PhysicalPredictionMarket.sol"
        />

        <div className="mt-10 grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <PredictionMarketPreview />
          </div>
          <div className="lg:col-span-2 card-soft p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono mb-3">
              How settlement closes
            </div>
            <ol className="space-y-3 text-sm text-ink-500 leading-relaxed">
              <li>
                <span className="text-ink-900 font-semibold">01. YES resolves</span> — Anyone submits{" "}
                <code className="font-mono text-xs bg-paper-100 px-1.5 py-0.5 rounded">
                  resolveYes(stockToken, attestation, router, swapData, minOut)
                </code>{" "}
                once RHJ signs off on the newly-minted d-TICKER.
              </li>
              <li>
                <span className="text-ink-900 font-semibold">02. Physical buy</span> — Full pot routes through UniversalRouter into
                d-TICKER at Chainlink-bounded slippage.
              </li>
              <li>
                <span className="text-ink-900 font-semibold">03. Pro-rata claim</span> — YES holders call{" "}
                <code className="font-mono text-xs bg-paper-100 px-1.5 py-0.5 rounded">
                  claim()
                </code>{" "}
                and receive d-TICKER weighted by their yesShares / totalYes.
              </li>
              <li>
                <span className="text-ink-900 font-semibold">04. NO branch</span> — If deadline lapses without an RHJ attestation, anyone
                permissionlessly calls{" "}
                <code className="font-mono text-xs bg-paper-100 px-1.5 py-0.5 rounded">
                  resolveNo()
                </code>{" "}
                and NO stakers reclaim USDG 1:1.
              </li>
            </ol>
          </div>
        </div>
      </Section>

      <Section className="border-t border-line bg-paper-100">
        <SectionHeader
          eyebrow="Candidate markets"
          title="What we'd deploy first."
          description="Every ticker below is a plausible near-term Robinhood mint candidate. A market per ticker × deadline is one CREATE-tx away."
        />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {CANDIDATE_MARKETS.map((m) => (
            <div key={m.ticker} className="card p-6 flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-11 w-11 rounded-2xl bg-ink-900 text-white font-bold text-xs flex items-center justify-center">
                  {m.ticker}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink-900 truncate">
                    {m.company}
                  </div>
                  <div className="text-[11px] text-ink-500 mt-0.5 font-mono">
                    deadline · {m.deadline}
                  </div>
                </div>
              </div>
              <p className="text-xs text-ink-500 leading-relaxed flex-1">
                {m.thesis}
              </p>
              <div className="mt-4 text-xs text-ink-500 font-mono flex items-center">
                Implied · <span className="text-ink-900 ml-1">50 / 50</span>
                <Link
                  href="#"
                  className="ml-auto text-ink-900 font-semibold inline-flex items-center gap-1 hover:underline"
                >
                  Pending deploy
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="Five invariants"
          title="What every market guarantees."
        />
        <div className="grid md:grid-cols-2 gap-4">
          {INVARIANTS.map((line) => (
            <div key={line} className="card p-5 flex items-start gap-3">
              <Check className="h-4 w-4 text-forest-500 mt-1 flex-shrink-0" />
              <span className="text-sm text-ink-900">{line}</span>
            </div>
          ))}
        </div>
      </Section>
    </MarketingShell>
  );
}
