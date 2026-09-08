import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";

export const metadata = {
  title: "Careers",
  description:
    "Join RPO Labs — the team behind the permissionless IPO subscription protocol.",
};

const ROLES = [
  {
    title: "Senior Solidity Engineer",
    team: "Contracts",
    where: "Remote · EU/NA overlap",
    band: "$220k – $360k + $RPO",
    desc: "Own the SubscriptionVault lifecycle. Ship v2 with cross-chain support via LayerZero. 5+ yrs solidity, Foundry native, comfortable writing invariant tests.",
  },
  {
    title: "Senior TypeScript / Full-stack Engineer",
    team: "Product",
    where: "Remote · EU/NA overlap",
    band: "$200k – $320k + $RPO",
    desc: "Own the app & SDK. Next.js 14 + wagmi + viem in production. Aesthetic bar is high — you love shipping pixel-perfect interfaces that also load fast.",
  },
  {
    title: "Trading & Market Making Lead",
    team: "Growth",
    where: "London · hybrid",
    band: "£190k – £280k + $RPO",
    desc: "Design the Pons-side liquidity strategy for $RPO and protocol-owned LP for newly-listed Stock Tokens. Ex-prop-desk background preferred.",
  },
  {
    title: "Head of Legal & Compliance",
    team: "Ops",
    where: "London or NYC",
    band: "$260k – $380k + $RPO",
    desc: "Own the Reg-S posture, jurisdictional map, and audit trail. Prior in-house at a broker/dealer or CeDeFi firm.",
  },
  {
    title: "Developer Advocate",
    team: "DevRel",
    where: "Remote",
    band: "$150k – $220k + $RPO",
    desc: "Ship the SDK, run the docs, host the community. Published open source + strong on-chain reputation preferred.",
  },
  {
    title: "Protocol Research (open)",
    team: "Research",
    where: "Remote",
    band: "Talent grants + $RPO",
    desc: "Any strong candidate with a novel protocol proposal, quantitative research paper, or MEV/AMM background — apply.",
  },
];

const PERKS = [
  { k: "Cash + $RPO", v: "Meaningful equity in the protocol." },
  { k: "4-day week", v: "Fridays are for deep work, not standups." },
  { k: "Off-sites", v: "Two full-team weeks per year (Lisbon + Tokyo)." },
  { k: "Hardware", v: "Full home-office refresh every 3 years." },
  { k: "Learning", v: "$5k/yr for books, conferences, courses." },
  { k: "Healthcare", v: "Top-tier medical in every jurisdiction we hire." },
];

export default function CareersPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Careers"
        title="Small team. High leverage."
        description="RPO is 11 people building the primary market for public equities on-chain. If you're the best in your field and want to build the missing rail, read on."
      />

      <section className="section">
        <div className="container-wide">
          <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
            <h2 className="font-display text-3xl text-ink-900">
              Open roles · {ROLES.length}
            </h2>
            <a
              href="mailto:jobs@rpo.xyz"
              className="text-sm text-forest-500 hover:underline"
            >
              Don&apos;t see your role? jobs@rpo.xyz →
            </a>
          </div>
          <div className="card divide-y divide-line">
            {ROLES.map((r) => (
              <div
                key={r.title}
                className="p-6 flex items-center justify-between gap-6 hover:bg-paper-100 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <div className="text-lg font-semibold text-ink-900">
                      {r.title}
                    </div>
                    <Badge>{r.team}</Badge>
                  </div>
                  <div className="text-sm text-ink-500 mb-2">{r.desc}</div>
                  <div className="text-xs text-ink-500 font-mono flex flex-wrap gap-4">
                    <span>{r.where}</span>
                    <span className="text-ink-300">·</span>
                    <span>{r.band}</span>
                  </div>
                </div>
                <a
                  href={`mailto:jobs@rpo.xyz?subject=Application: ${encodeURIComponent(
                    r.title
                  )}`}
                  className="btn-secondary text-sm flex-shrink-0"
                >
                  Apply <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide">
          <div className="eyebrow mb-4">Perks</div>
          <h2 className="font-display text-3xl text-ink-900 mb-8">
            Sensible defaults.
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {PERKS.map((p) => (
              <div key={p.k} className="card p-6">
                <div className="text-sm font-semibold text-ink-900">{p.k}</div>
                <div className="text-sm text-ink-500 mt-2 leading-relaxed">
                  {p.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section border-t border-line">
        <div className="container-wide max-w-3xl text-center">
          <div className="eyebrow mb-4 justify-center">Interview process</div>
          <div className="grid md:grid-cols-4 gap-4 text-left">
            {[
              { n: "01", h: "Intro (30m)", b: "Founder call, both ways." },
              { n: "02", h: "Craft (2h)", b: "A real task, paid, on your own time." },
              { n: "03", h: "Review (1h)", b: "Ship your work with two engineers." },
              { n: "04", h: "Team (1h)", b: "Meet 2-3 future teammates. Offer within 48h." },
            ].map((s) => (
              <div key={s.n} className="card p-6">
                <div className="text-[11px] font-mono text-ink-500 mb-3">
                  {s.n}
                </div>
                <div className="font-semibold text-ink-900">{s.h}</div>
                <div className="text-xs text-ink-500 mt-2">{s.b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
