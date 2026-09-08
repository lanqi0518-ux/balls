import { Metadata } from "next";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Check, Shield, Lock, Layers } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "Security",
  description: "Audits, invariants, bug bounty, disclosures.",
};

export default function SecurityPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Security"
        title={
          <>
            Trust minimized.{" "}
            <span className="italic text-forest-500">Verifiable</span>. Refund by
            default.
          </>
        }
        description="Every USDG deposit sits in a per-IPO CREATE2 vault with no admin key, no upgrade path, and a mandatory refund switch anyone can flip if the IPO doesn't materialize."
      />

      <Section>
        <SectionHeader eyebrow="Architecture" title="Guarantees" />
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              Icon: Shield,
              title: "No upgrades. No admin drain.",
              body: "Vaults are non-upgradable. The registry owner can only announce new IPOs; it cannot touch any deployed vault's funds.",
            },
            {
              Icon: Lock,
              title: "CREATE2 addresses",
              body: "Every vault's address is deterministic from the ticker. You can pre-bridge USDG in and know exactly which contract you're funding.",
            },
            {
              Icon: Layers,
              title: "Anyone-can-refund",
              body: "After the fulfillment deadline, any address can call activateRefund(). No coordination required — the protocol self-heals when Robinhood doesn't launch a promised ticker.",
            },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="card p-8">
              <div className="h-10 w-10 rounded-lg bg-forest-50 text-forest-500 flex items-center justify-center mb-5">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-fg mb-2">{title}</h3>
              <p className="text-sm text-fg-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="audits" className="border-t border-line bg-paper-100">
        <SectionHeader
          eyebrow="Audits"
          title="Rolling audit with two independent firms."
          description="Report will be published here on completion. Latest revision hash matches the deployed bytecode."
        />
        <div className="grid md:grid-cols-2 gap-4">
          <AuditCard
            firm="Firm A"
            status="In progress"
            scope="v1 core (Registry, Vault, Booster, Adapter)"
            date="Q4 2026"
          />
          <AuditCard
            firm="Firm B"
            status="Scheduled"
            scope="v1 loop (LeverageLooper + Morpho integration)"
            date="Q4 2026"
          />
        </div>
      </Section>

      <Section id="bounty">
        <SectionHeader
          eyebrow="Bug bounty"
          title="Report a bug. Get paid."
        />
        <div className="card p-8 lg:p-10 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <p className="text-fg-muted leading-relaxed">
              We run a public bug bounty scoped to the deployed core contracts.
              Payouts are in USDG, paid within 72h of triage confirmation.
            </p>
            <ul className="space-y-2 text-sm">
              {[
                ["Critical (funds at risk)", "$50,000 – $150,000"],
                ["High (allocation math manipulation)", "$10,000 – $50,000"],
                ["Medium (griefing / UX)", "$1,000 – $10,000"],
                ["Low / info", "$100 – $1,000"],
              ].map(([sev, payout]) => (
                <li
                  key={sev}
                  className="flex items-center justify-between py-2 border-b border-line last:border-0"
                >
                  <span className="text-fg">{sev}</span>
                  <span className="font-mono text-forest-500">{payout}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-l border-line pl-6 lg:pl-8 space-y-3">
            <div className="text-xs uppercase tracking-[0.14em] text-fg-dim">
              Contact
            </div>
            <div className="font-mono text-sm text-fg">security@rpo.xyz</div>
            <div className="text-xs text-fg-muted">
              PGP fingerprint:{" "}
              <span className="font-mono">
                A1B2 C3D4 E5F6 7890 …
              </span>
            </div>
            <LinkButton
              href="mailto:security@rpo.xyz"
              size="sm"
              className="mt-3"
              external
            >
              Report a vulnerability
            </LinkButton>
          </div>
        </div>
      </Section>

      <Section id="threat-model" className="border-t border-line">
        <SectionHeader
          eyebrow="Threat model"
          title="Known risks. Written down."
        />
        <Container variant="copy" className="!px-0">
          <div className="space-y-3">
            {[
              {
                risk: "Robinhood pauses a Stock Token before we can fulfill.",
                mitigation:
                  "Fulfillment fails → refund path activates → subscribers withdraw USDG 1:1.",
              },
              {
                risk: "Rialto propAMM is illiquid or paused at launch.",
                mitigation:
                  "Adapter falls back to Uniswap V3. If both are worse than a configurable slippage threshold, the vault waits and can be retried by anyone.",
              },
              {
                risk: "$RPO whale accumulates 80% of stake and monopolizes boost.",
                mitigation:
                  "Boost curve is sqrt-shaped and hard-capped at 3×. A whale's marginal boost above 25% share is negligible.",
              },
              {
                risk: "Keeper stops running.",
                mitigation:
                  "markLaunched() and activateRefund() are permissionless. If our keeper is offline, any user (or a Chainlink Automation upkeep) can trigger the same state transition.",
              },
              {
                risk: "USDG on Robinhood Chain has issuer risk.",
                mitigation:
                  "This is upstream of RPO — we can't fix stablecoin risk. All vaults are settled in the exact same USDG you deposited; RPO adds no additional custody hop.",
              },
            ].map((r, i) => (
              <div key={i} className="card p-6">
                <div className="text-sm font-semibold text-fg mb-2">
                  ⚠ {r.risk}
                </div>
                <div className="flex items-start gap-2 text-sm text-fg-muted">
                  <Check className="h-4 w-4 text-forest-500 mt-0.5 flex-shrink-0" />
                  <span>{r.mitigation}</span>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>
    </MarketingShell>
  );
}

function AuditCard({
  firm,
  status,
  scope,
  date,
}: {
  firm: string;
  status: string;
  scope: string;
  date: string;
}) {
  return (
    <div className="card p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="font-display text-2xl text-fg">{firm}</div>
        <Badge variant="forest" dot>
          {status}
        </Badge>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between border-b border-line pb-2">
          <span className="text-fg-muted">Scope</span>
          <span className="text-fg text-right max-w-xs">{scope}</span>
        </div>
        <div className="flex justify-between border-b border-line pb-2">
          <span className="text-fg-muted">Target date</span>
          <span className="text-fg font-mono">{date}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-fg-muted">Report</span>
          <span className="text-fg-dim">Publishes on completion</span>
        </div>
      </div>
    </div>
  );
}
