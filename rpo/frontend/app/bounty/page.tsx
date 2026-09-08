import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight, Check, Lock } from "@/components/ui/Icons";
import { Prose } from "@/components/ui/Prose";
import { H2 } from "@/components/ui/H";

export const metadata = {
  title: "Bug bounty",
  description:
    "Immunefi-hosted bug bounty. Up to $500,000 for critical smart-contract vulnerabilities.",
};

const TIERS = [
  {
    tier: "Critical",
    max: "$500,000",
    scope: "Any loss of user funds, permanent freezing, or minting outside supply cap.",
    color: "bg-rose-50 border-rose-200 text-rose-700",
  },
  {
    tier: "High",
    max: "$60,000",
    scope: "Temporary freezing, griefing at scale, or theft of vault yield.",
    color: "bg-peach-50 border-peach-200 text-peach-600",
  },
  {
    tier: "Medium",
    max: "$12,000",
    scope: "Contract state corruption, incorrect boost calc, denial of service.",
    color: "bg-forest-50 border-forest-200 text-forest-600",
  },
  {
    tier: "Low",
    max: "$2,000",
    scope: "Best-practice violations, minor economic edges without impact.",
    color: "bg-paper-200 border-line text-ink-500",
  },
];

export default function BountyPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Bug bounty"
        title="$500,000 for a real critical."
        description="Hosted on Immunefi. Safe-harbor for good-faith research. Same-day acknowledgment. Bounty pool funded from protocol fees and topped up by DAO vote."
      />

      <section className="section">
        <div className="container-wide grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map((t) => (
            <div key={t.tier} className="card p-6">
              <div
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium " +
                  t.color
                }
              >
                {t.tier}
              </div>
              <div className="font-display text-3xl text-ink-900 mt-4 tabular-nums">
                {t.max}
              </div>
              <div className="text-sm text-ink-500 mt-3 leading-relaxed">
                {t.scope}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide max-w-4xl">
          <Prose>
            <H2 id="scope">In scope</H2>
            <ul>
              <li>
                <code>IPORegistry</code>,{" "}
                <code>SubscriptionVault</code> (every deployed instance),{" "}
                <code>AllocationBooster</code>,{" "}
                <code>RialtoAdapter</code>,{" "}
                <code>LeverageLooper</code>,{" "}
                <code>FeeCollector</code>.
              </li>
              <li>
                Anything at{" "}
                <code>rpo.xyz</code>,{" "}
                <code>app.rpo.xyz</code>,{" "}
                <code>api.rpo.xyz</code>.
              </li>
              <li>
                Public SDK <code>@rpo/sdk</code>.
              </li>
            </ul>
            <H2 id="out">Out of scope</H2>
            <ul>
              <li>
                Robinhood Chain sequencer bugs — report those to{" "}
                <a href="mailto:security@robinhood.com">
                  security@robinhood.com
                </a>
                .
              </li>
              <li>Rialto propAMM internals.</li>
              <li>Chainlink oracles.</li>
              <li>
                Third-party wallets, RPC providers, and end-user devices.
              </li>
              <li>DoS via chain congestion.</li>
              <li>Frontend UX bugs that don&apos;t compromise funds.</li>
            </ul>
            <H2 id="rules">Rules of engagement</H2>
            <ul>
              <li>
                <strong>Test only against testnets</strong>{" "}
                (<code>rhc-testnet.rpo.xyz</code>) or your own funds on
                mainnet. Do not disrupt other users&apos; positions.
              </li>
              <li>
                Do not attempt social-engineering of RPO Labs staff or
                infrastructure vendors.
              </li>
              <li>
                Do not exfiltrate more than the minimum data required to
                demonstrate the vulnerability.
              </li>
              <li>
                Do not disclose publicly until (a) 90 days after report,
                (b) fix + 30 days, or (c) our written go-ahead — whichever
                comes first.
              </li>
              <li>
                Good-faith research is protected under the{" "}
                <a href="https://immunefi.com/rpo/safe-harbor">
                  Immunefi safe-harbor v2
                </a>{" "}
                — we will not pursue legal action.
              </li>
            </ul>
            <H2 id="process">Process &amp; SLA</H2>
            <ol>
              <li>
                Submit via{" "}
                <a href="https://immunefi.com/bounty/rpo">Immunefi</a> or{" "}
                <a href="mailto:security@rpo.xyz">security@rpo.xyz</a>{" "}
                (PGP <code>0xA1B2 C3D4 E5F6</code>).
              </li>
              <li>
                <strong>&lt; 24h</strong>: acknowledgment.
              </li>
              <li>
                <strong>&lt; 72h</strong>: severity triage + mitigation
                timeline.
              </li>
              <li>Payout in USDG within 7 days of fix.</li>
              <li>Public disclosure post-fix with attribution.</li>
            </ol>
          </Prose>
        </div>
      </section>

      <section className="section border-t border-line">
        <div className="container-wide">
          <div className="card-dark p-10 flex items-center justify-between gap-6 flex-wrap">
            <div>
              <Badge variant="peach">Report</Badge>
              <div className="font-display text-3xl mt-3">
                Found something? Send it now.
              </div>
              <div className="text-sm text-white/70 mt-2 max-w-xl">
                Submissions via Immunefi are prioritized; direct email is
                also accepted for time-critical issues.
              </div>
            </div>
            <div className="flex gap-3">
              <a
                href="https://immunefi.com/bounty/rpo"
                className="btn-primary text-sm bg-peach-500 hover:bg-peach-600"
              >
                Immunefi <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <a
                href="mailto:security@rpo.xyz"
                className="btn text-sm border border-white/20 hover:border-white text-white rounded-full px-5 py-2.5"
              >
                security@rpo.xyz
              </a>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
