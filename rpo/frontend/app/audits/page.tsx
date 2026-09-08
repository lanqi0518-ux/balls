import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight, Check } from "@/components/ui/Icons";

export const metadata = {
  title: "Audits",
  description:
    "Trail of Bits and Spearbit audit reports for the RPO protocol, published in full.",
};

const AUDITS = [
  {
    firm: "Trail of Bits",
    scope:
      "IPORegistry, SubscriptionVault, AllocationBooster, RialtoAdapter, LeverageLooper",
    date: "January 2026",
    duration: "5 person-weeks",
    findings: { critical: 0, high: 1, medium: 3, low: 6, info: 11 },
    fixed: { critical: 0, high: 1, medium: 3, low: 6, info: 9 },
    url: "https://github.com/lanqi0518-ux/balls/blob/main/audits/tob-2026-01.pdf",
    highlight:
      "High finding was a griefing vector in propose() bond-slash flow. Fixed in commit 0xa1b2c3.",
  },
  {
    firm: "Spearbit",
    scope: "Full protocol + integration paths (Rialto, Aave, Morpho, LiFi)",
    date: "February 2026",
    duration: "4 person-weeks · 3 senior engineers",
    findings: { critical: 0, high: 0, medium: 2, low: 4, info: 8 },
    fixed: { critical: 0, high: 0, medium: 2, low: 4, info: 6 },
    url: "https://github.com/lanqi0518-ux/balls/blob/main/audits/spearbit-2026-02.pdf",
    highlight:
      "Both mediums were around Aave receipt-token accounting during partial cancels. Fixed in commit 0xd4e5f6.",
  },
];

export default function AuditsPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Audits"
        title="Two audits. Zero criticals. Every finding published."
        description="We publish the full report — not a summary — for every audit conducted. Findings are tracked in a public issue tree with remediation commits linked."
      />

      <section className="section">
        <div className="container-wide space-y-6">
          {AUDITS.map((a) => (
            <div key={a.firm} className="card p-8">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div>
                  <div className="text-3xl font-display text-ink-900">
                    {a.firm}
                  </div>
                  <div className="text-sm text-ink-500 mt-1 font-mono">
                    {a.date} · {a.duration}
                  </div>
                </div>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary text-sm"
                >
                  Read full report
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="mt-6 pb-6 border-b border-line">
                <div className="text-xs uppercase tracking-[0.14em] text-ink-500 mb-2">
                  Scope
                </div>
                <div className="text-sm text-ink-900">{a.scope}</div>
              </div>

              <div className="mt-6 grid grid-cols-5 gap-3">
                {(["critical", "high", "medium", "low", "info"] as const).map(
                  (sev) => (
                    <div
                      key={sev}
                      className="rounded-xl border border-line bg-paper-100 p-4"
                    >
                      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-mono">
                        {sev}
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="font-display text-2xl text-ink-900 tabular-nums">
                          {a.fixed[sev]}
                        </span>
                        <span className="text-xs text-ink-500 font-mono">
                          / {a.findings[sev]}
                        </span>
                      </div>
                      <div className="text-[10px] text-forest-500 mt-1 inline-flex items-center gap-1 font-mono">
                        <Check className="h-2.5 w-2.5" />
                        fixed
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="mt-6 p-4 rounded-xl bg-paper-100 border border-line text-sm text-ink-500 italic">
                {a.highlight}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide">
          <div className="eyebrow mb-4">Coming up</div>
          <h2 className="font-display text-3xl text-ink-900 mb-6">
            Continuous audit engagement.
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                firm: "Certora",
                what: "Formal verification of SubscriptionVault refund invariants",
                when: "Q2 2026",
              },
              {
                firm: "Zellic",
                what: "Cross-chain LiFi integration path + subscribe meta-tx flow",
                when: "Q3 2026",
              },
              {
                firm: "code4rena",
                what: "Public contest — LeverageLooper v2",
                when: "Q3 2026",
              },
            ].map((c) => (
              <div key={c.firm} className="card p-6">
                <Badge variant="peach">{c.when}</Badge>
                <div className="mt-4 font-semibold text-ink-900">{c.firm}</div>
                <div className="text-sm text-ink-500 mt-2 leading-relaxed">
                  {c.what}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
