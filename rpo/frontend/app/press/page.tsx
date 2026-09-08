import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { ArrowUpRight } from "@/components/ui/Icons";

export const metadata = {
  title: "Press",
  description: "Press kit, media coverage, and press contact for RPO.",
};

const COVERAGE = [
  {
    outlet: "Bloomberg",
    title: "Robinhood's Chain Sprouts A Shadow IPO Market",
    date: "Feb 24, 2026",
    url: "#",
  },
  {
    outlet: "The Block",
    title: "RPO takes aim at retail-inaccessible IPOs with permissionless subscription vaults",
    date: "Feb 19, 2026",
    url: "#",
  },
  {
    outlet: "Blockworks",
    title: "Inside the boost curve: how RPO staking allocates scarce IPO supply",
    date: "Feb 11, 2026",
    url: "#",
  },
  {
    outlet: "Bankless",
    title: "The IPO trade goes on-chain — Q&A with RPO founders",
    date: "Feb 04, 2026",
    url: "#",
  },
  {
    outlet: "Delphi Digital",
    title: "Tokenized equity primary markets: RPO's design in context",
    date: "Jan 28, 2026",
    url: "#",
  },
  {
    outlet: "Messari",
    title: "State of RPO: launch metrics, allocation efficiency, and boost distribution",
    date: "Jan 20, 2026",
    url: "#",
  },
];

export default function PressPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Press"
        title="Coverage & contact."
        description="For interviews, embargoed briefings, and press inquiries, email press@rpo.xyz. Same-day response Monday through Friday."
      />

      <section className="section">
        <div className="container-wide grid lg:grid-cols-3 gap-4">
          {[
            { k: "Founded", v: "2025" },
            { k: "Team size", v: "11" },
            { k: "Investors", v: "Fair launch — no VC round" },
          ].map((s) => (
            <div key={s.k} className="card p-8">
              <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500 mb-3">
                {s.k}
              </div>
              <div className="font-display text-3xl text-ink-900">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-tight border-t border-line">
        <div className="container-wide">
          <div className="flex items-end justify-between mb-6">
            <h2 className="font-display text-3xl text-ink-900">Coverage</h2>
            <a
              href="/brand/rpo-brand-kit.zip"
              className="text-sm text-forest-500 hover:underline inline-flex items-center gap-1"
            >
              Brand kit <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="card divide-y divide-line">
            {COVERAGE.map((c) => (
              <a
                key={c.title}
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="p-6 flex items-center justify-between gap-6 hover:bg-paper-100 transition-colors group"
              >
                <div className="flex-1">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500 font-mono mb-2">
                    {c.outlet} · {c.date}
                  </div>
                  <div className="text-lg font-semibold text-ink-900">
                    {c.title}
                  </div>
                </div>
                <ArrowUpRight className="h-5 w-5 text-ink-500 group-hover:text-ink-900 transition-colors flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section border-t border-line bg-paper-100">
        <div className="container-wide max-w-3xl">
          <div className="card p-10">
            <div className="text-xs uppercase tracking-[0.22em] text-ink-500 font-mono mb-3">
              Boilerplate
            </div>
            <div className="prose prose-lg text-ink-600 leading-relaxed">
              <p className="mb-4">
                <strong>RPO</strong> is a permissionless IPO subscription
                protocol built on Robinhood Chain. RPO lets any eligible
                wallet subscribe to real US-listed IPO tokens the moment
                they are issued, priced through Rialto&apos;s propAMM and
                allocated pro-rata plus a $RPO-weighted staker boost. The
                protocol is fully on-chain, non-upgradable, and carries no
                admin key.
              </p>
              <p>
                Founded in 2025, RPO is developed by an 11-person team
                based in London and remote. $RPO launched fair on Pons in
                early 2026, with no team unlock cliff and no VC round.
                More at{" "}
                <a
                  href="https://rpo.xyz"
                  className="text-forest-500 hover:underline"
                >
                  rpo.xyz
                </a>
                .
              </p>
            </div>
            <button className="mt-6 text-xs text-ink-500 hover:text-ink-900 font-mono">
              [click to copy]
            </button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
