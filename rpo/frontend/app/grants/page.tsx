import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight, Check } from "@/components/ui/Icons";
import { Prose } from "@/components/ui/Prose";
import { H2 } from "@/components/ui/H";

export const metadata = {
  title: "Grants",
  description:
    "Non-dilutive grants for teams building on top of the RPO protocol.",
};

const TRACKS = [
  {
    label: "Integrations",
    range: "$10k – $50k",
    ex: "Wallet embeds · yield aggregators · portfolio dashboards",
    color: "text-forest-500 border-forest-200 bg-forest-50",
  },
  {
    label: "Research",
    range: "$5k – $25k",
    ex: "Boost-curve analysis · allocation efficiency papers · MEV studies",
    color: "text-peach-600 border-peach-200 bg-peach-50",
  },
  {
    label: "Tooling",
    range: "$5k – $30k",
    ex: "Solidity linters · subgraph clones · SDK ports (Rust, Python, Go)",
    color: "text-ink-500 border-line bg-paper-100",
  },
  {
    label: "Community",
    range: "$1k – $10k",
    ex: "Educational threads · translated docs · IRL meetups",
    color: "text-ink-500 border-line bg-paper-100",
  },
];

const AWARDED = [
  { team: "morpho-vault-dashboard.xyz", track: "Integrations", amount: 25_000 },
  { team: "chinese-docs @rpo-cn", track: "Community", amount: 6_000 },
  { team: "@0xmaki — Allocation efficiency study", track: "Research", amount: 18_000 },
  { team: "@rustrpo — SDK Rust port", track: "Tooling", amount: 22_000 },
  { team: "safe-vault-alerts.eth", track: "Integrations", amount: 12_000 },
];

export default function GrantsPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Grants"
        title="Fund the ecosystem, not the treasury."
        description="10% of the $RPO supply and 20% of monthly buyback revenue is earmarked for grants. If your project extends, integrates with, or measures RPO — we want to fund it."
      />

      <section className="section">
        <div className="container-wide grid md:grid-cols-4 gap-4">
          {TRACKS.map((t) => (
            <div key={t.label} className="card p-6">
              <div
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium " +
                  t.color
                }
              >
                {t.label}
              </div>
              <div className="font-display text-2xl text-ink-900 mt-4 tabular-nums">
                {t.range}
              </div>
              <div className="text-xs text-ink-500 mt-3 leading-relaxed">
                {t.ex}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide max-w-4xl">
          <Prose>
            <H2 id="apply">How to apply</H2>
            <ol>
              <li>
                Open a new thread in the{" "}
                <a href="https://forum.rpo.xyz/c/grants">grants forum</a>{" "}
                describing the project, milestones, and requested amount.
              </li>
              <li>
                Wait 7 days for community feedback. Iterate on scope.
              </li>
              <li>
                A rolling review committee (5 seats, elected quarterly by
                $RPO holders) votes within 14 days.
              </li>
              <li>
                Approved grants pay 30% upfront in USDG, 40% at midpoint,
                30% on final milestone.
              </li>
            </ol>

            <H2 id="criteria">What we fund</H2>
            <ul>
              <li>
                <strong>Real usefulness</strong> — does the project make
                the RPO experience meaningfully better for a real user?
              </li>
              <li>
                <strong>Open source</strong> — code released under
                MIT/Apache-2.0.
              </li>
              <li>
                <strong>Sustainable</strong> — either self-funding after
                the grant, or a natural transfer to public-goods funding.
              </li>
              <li>
                <strong>No token launches</strong> — we do not fund
                projects whose end-state is a token sale.
              </li>
            </ul>
          </Prose>

          <div className="mt-10 flex justify-center">
            <a
              href="https://forum.rpo.xyz/c/grants"
              className="btn-primary"
            >
              Open a grant thread
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-wide">
          <h2 className="font-display text-3xl text-ink-900 mb-8">
            Awarded so far
          </h2>
          <div className="card divide-y divide-line">
            {AWARDED.map((a, i) => (
              <div
                key={i}
                className="p-5 flex items-center justify-between hover:bg-paper-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-8 w-8 rounded-full bg-forest-50 border border-forest-200 flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-forest-500" />
                  </div>
                  <div>
                    <div className="text-ink-900 font-medium">{a.team}</div>
                    <div className="text-xs text-ink-500 font-mono">
                      {a.track}
                    </div>
                  </div>
                </div>
                <div className="font-mono text-ink-900 tabular-nums">
                  ${a.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          <div className="text-sm text-ink-500 mt-4 text-right font-mono">
            Total awarded: ${AWARDED.reduce((a, b) => a + b.amount, 0).toLocaleString()}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
