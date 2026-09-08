import { Metadata } from "next";
import Link from "next/link";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "About",
  description: "Who builds RPO and why.",
};

const PRINCIPLES = [
  {
    title: "Real, not synthetic.",
    body: "We route through Robinhood's real Stock Tokens and Rialto's real market maker. If it can't be settled on-chain against actual securities infrastructure, we don't ship it.",
  },
  {
    title: "Permissionless by default.",
    body: "No KYC at the protocol level. Wallet in, tokens out. Any restrictions come from the underlying issuer, not from us layering a broker on top.",
  },
  {
    title: "Refund is the default state.",
    body: "Every vault ships with an automatic refund path. If the IPO doesn't happen on-time, subscribers pull their capital back 1:1. This isn't a feature — it's an invariant.",
  },
  {
    title: "The chain is the audit.",
    body: "All flows are on public contracts. Registry addresses, vault CREATE2 salts, buyback wallets — everything is inspectable at /docs#contracts.",
  },
];

const ROADMAP = [
  {
    quarter: "Q3 2026",
    label: "Live",
    tone: "mint",
    items: [
      "Testnet deployment on Robinhood Chain",
      "Rialto adapter + Uniswap V3 fallback",
      "$RPO fair launch on Pons paired with SPY",
      "Marketing site + IPO calendar",
    ],
  },
  {
    quarter: "Q4 2026",
    label: "Next",
    tone: "default",
    items: [
      "Mainnet audit (two firms, rolling)",
      "LeverageLooper v1 (Morpho Blue integration)",
      "LiFi bridge widget for one-click USDC → USDG",
      "Public bug bounty ($150k pool)",
    ],
  },
  {
    quarter: "Q1 2027",
    label: "Planned",
    tone: "default",
    items: [
      "Delegated allocation for institutional wallets",
      "Automated buyback + $RPO burn treasury",
      "Multi-issuer support (Backed, Ondo, xStocks)",
      "Cross-chain SubscriptionVaults via LayerZero",
    ],
  },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="About"
        title={
          <>
            RPO is a small team building the missing{" "}
            <span className="italic text-forest-500">primary-market</span>{" "}
            primitive for on-chain equities.
          </>
        }
        description="We think tokenized IPOs are the most obvious use case for the securities-token stack Robinhood shipped in 2025 — and we want to make sure the first billion in on-chain IPO volume goes through a permissionless, refundable, transparent vault instead of a broker-style app that could go dark tomorrow."
      />

      <Section>
        <SectionHeader
          eyebrow="Principles"
          title="Four rules we don't break."
        />
        <div className="grid md:grid-cols-2 gap-4">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="card p-8">
              <h3 className="font-display text-2xl text-fg mb-3">{p.title}</h3>
              <p className="text-fg-muted leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="roadmap" className="border-t border-line bg-paper-100">
        <SectionHeader
          eyebrow="Roadmap"
          title="Public, versioned, non-fictional."
          description="We ship in the open. Every roadmap item is trackable in the GitHub milestones."
        />
        <div className="grid lg:grid-cols-3 gap-6">
          {ROADMAP.map((r) => (
            <div key={r.quarter} className="card p-8 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.14em] text-fg-dim font-mono">
                  {r.quarter}
                </div>
                <Badge
                  variant={r.tone === "mint" ? "forest" : "default"}
                  dot={r.tone === "mint"}
                >
                  {r.label}
                </Badge>
              </div>
              <ul className="space-y-3 text-sm text-fg-muted">
                {r.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-forest-500 mt-1">›</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section id="careers">
        <SectionHeader
          eyebrow="Careers"
          title="Small team. Open commit history."
          description="We hire in public and pay in stables. No résumé screen — the bar is a solid PR."
        />
        <Container variant="tight" className="!px-0">
          <div className="card divide-y divide-line">
            {[
              {
                role: "Senior Solidity engineer",
                loc: "Remote · global",
                type: "Full-time",
              },
              {
                role: "Frontend engineer (Next.js + wagmi)",
                loc: "Remote · global",
                type: "Full-time",
              },
              {
                role: "Protocol security lead",
                loc: "Remote · global",
                type: "Contract",
              },
            ].map((j) => (
              <a
                key={j.role}
                href="mailto:jobs@rpo.xyz"
                className="flex items-center justify-between p-6 hover:bg-paper-100 transition-colors"
              >
                <div>
                  <div className="text-lg font-medium text-fg">{j.role}</div>
                  <div className="text-sm text-fg-muted mt-1">{j.loc}</div>
                </div>
                <div className="text-sm text-fg-muted">{j.type} ↗</div>
              </a>
            ))}
          </div>
        </Container>
      </Section>

      <Section id="brand" className="border-t border-line">
        <SectionHeader eyebrow="Brand" title="Brand kit" />
        <div className="grid md:grid-cols-3 gap-4">
          <div className="card p-8 aspect-square flex items-center justify-center">
            <div className="text-5xl font-display text-fg">RPO</div>
          </div>
          <div className="card p-8 aspect-square flex items-center justify-center bg-forest-500 text-ink-950">
            <div className="text-5xl font-display">RPO</div>
          </div>
          <div className="card p-8 aspect-square flex items-center justify-center bg-cream text-ink-950">
            <div className="text-5xl font-display">RPO</div>
          </div>
        </div>
        <p className="mt-6 text-sm text-fg-muted">
          Download the full kit (SVG logos, wordmarks, color tokens){" "}
          <Link href="/brand.zip" className="text-forest-500 hover:underline">
            here
          </Link>
          .
        </p>
      </Section>
    </MarketingShell>
  );
}
