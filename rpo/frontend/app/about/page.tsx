import { Metadata } from "next";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "About",
  description: "Who builds RPO and why. Pre-launch scaffolding — no live protocol yet.",
};

const PRINCIPLES = [
  {
    title: "Real, not synthetic.",
    body: "The intent is to route through real Robinhood-issued Stock Tokens and a real market maker. If it can't be settled on-chain against actual securities infrastructure, it doesn't ship.",
  },
  {
    title: "Permissionless by default.",
    body: "No KYC at the protocol level. Wallet in, tokens out. Any restrictions come from the underlying issuer, not from a broker layered on top.",
  },
  {
    title: "Refund is the default state.",
    body: "Every subscription vault ships with an automatic refund path. If the IPO doesn't happen on time, subscribers pull their capital back 1:1. This is a contract-level invariant, not a promise.",
  },
  {
    title: "The chain is the audit.",
    body: "All flows are on public contracts. Once contracts are deployed, registry addresses, vault CREATE2 salts, and buyback wallets are all inspectable via the block explorer.",
  },
];

const REPO_URL = "https://github.com/lanqi0518-ux/balls";

export default function AboutPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="About"
        title={
          <>
            RPO is a small effort building the missing{" "}
            <span className="italic text-forest-500">primary-market</span>{" "}
            primitive for on-chain equities.
          </>
        }
        description="Tokenized IPOs are one of the most obvious use cases for the securities-token stack Robinhood shipped in 2025. The goal is to make sure the first billion in on-chain IPO volume goes through a permissionless, refundable, transparent vault rather than through a broker-style app that could go dark tomorrow."
      />

      <Section>
        <div className="card p-6 border-l-4 border-peach-500 bg-peach-50/40 mb-10">
          <Badge variant="peach">Pre-launch</Badge>
          <p className="text-sm text-ink-500 mt-3 leading-relaxed">
            RPO has not launched. There is no live protocol, no live team
            statistics page, and no formal organization page beyond this
            scaffold. Anything that changes will be reflected here.
          </p>
        </div>

        <SectionHeader
          eyebrow="Principles"
          title="Four rules the design tries to hold."
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
          description="The four-phase roadmap lives on its own page — nothing has shipped yet, and this site will not backfill any 'delivered' claims until real on-chain evidence exists."
        />
        <a
          href="/roadmap"
          className="btn-primary text-sm inline-flex w-fit"
        >
          Read the roadmap →
        </a>
      </Section>

      <Section id="repo" className="border-t border-line">
        <SectionHeader
          eyebrow="Source"
          title="Everything is on GitHub."
          description="The right way to evaluate what RPO is today is to read the code. There is no closed-source path."
        />
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="btn-primary text-sm inline-flex w-fit"
        >
          View the repository →
        </a>
      </Section>
    </MarketingShell>
  );
}
