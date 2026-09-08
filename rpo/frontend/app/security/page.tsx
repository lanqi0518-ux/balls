import Link from "next/link";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Prose } from "@/components/ui/Prose";
import { H2 } from "@/components/ui/H";
import { Badge } from "@/components/ui/Badge";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Shield, Lock, Check, ArrowUpRight } from "@/components/ui/Icons";

export const metadata = {
  title: "Security",
  description:
    "How RPO minimizes trust — non-upgradable contracts, permissionless refunds, published audits.",
};

const PILLARS = [
  {
    Icon: Lock,
    title: "Non-upgradable",
    body: "Every contract is deployed without proxy. selfdestruct is removed. There is no admin key that can pause, drain, or migrate user funds.",
  },
  {
    Icon: Shield,
    title: "Permissionless refunds",
    body: "If a vault fails to fulfill by its deadline, anyone — not just the subscriber — can trigger a 100% refund plus Aave yield.",
  },
  {
    Icon: Check,
    title: "Two audits + bounty",
    body: "Trail of Bits and Spearbit audits published in full. Immunefi bounty capped at $500k for critical issues.",
  },
];

const CHECKS = [
  { label: "Slither static analysis", pass: true, run: "on every commit" },
  { label: "Foundry unit tests", pass: true, run: "228 cases, 100% pass" },
  { label: "Foundry invariant tests", pass: true, run: "12 invariants" },
  { label: "Echidna fuzzing", pass: true, run: "48h continuous" },
  { label: "Certora formal spec", pass: true, run: "18 rules verified" },
  { label: "Manticore symbolic exec", pass: true, run: "on release only" },
];

export default function SecurityPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Security"
        title="Minimize trust. Publish everything."
        description="RPO's security model rests on unowned contracts, permissionless recovery, and continuous testing. Below is exactly what that means in practice."
      />

      <section className="section">
        <div className="container-wide grid md:grid-cols-3 gap-4">
          {PILLARS.map((p) => (
            <div key={p.title} className="card p-8">
              <p.Icon className="h-5 w-5 text-forest-500 mb-4" />
              <div className="font-semibold text-ink-900 text-lg mb-2">
                {p.title}
              </div>
              <div className="text-sm text-ink-500 leading-relaxed">{p.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide">
          <div className="eyebrow mb-4">Continuous checks</div>
          <h2 className="font-display text-3xl text-ink-900 mb-8">
            Green on every push.
          </h2>
          <div className="card divide-y divide-line">
            {CHECKS.map((c) => (
              <div
                key={c.label}
                className="flex items-center justify-between p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="h-8 w-8 rounded-full bg-forest-50 border border-forest-200 flex items-center justify-center">
                    <Check className="h-4 w-4 text-forest-500" />
                  </div>
                  <div>
                    <div className="text-ink-900 font-medium">{c.label}</div>
                    <div className="text-xs text-ink-500 font-mono">
                      {c.run}
                    </div>
                  </div>
                </div>
                <Badge variant="forest" dot>
                  Passing
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-wide grid md:grid-cols-2 gap-6">
          <Link
            href="/audits"
            className="card-hover p-8 flex flex-col gap-4 group"
          >
            <Shield className="h-5 w-5 text-forest-500" />
            <div>
              <div className="text-2xl font-display text-ink-900">Audit reports</div>
              <div className="text-sm text-ink-500 mt-2">
                Full Trail of Bits and Spearbit reports, published with
                remediation status per finding.
              </div>
            </div>
            <div className="text-sm text-ink-900 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
              Read audits <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </Link>
          <Link
            href="/bounty"
            className="card-hover p-8 flex flex-col gap-4 group"
          >
            <Lock className="h-5 w-5 text-peach-500" />
            <div>
              <div className="text-2xl font-display text-ink-900">Bug bounty</div>
              <div className="text-sm text-ink-500 mt-2">
                Immunefi-hosted, $500k cap for critical smart-contract
                issues. Scope, safe harbor and disclosure timelines.
              </div>
            </div>
            <div className="text-sm text-ink-900 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
              Submit a report <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        </div>
      </section>

      <section className="section-tight border-t border-line">
        <div className="container-wide max-w-4xl">
          <Prose>
            <H2 id="invariants">Formal invariants</H2>
            <p>
              12 invariants are enforced by Foundry&apos;s randomized
              harness on every commit — 25,600 sequences per invariant per
              CI run. Any failure blocks release. Certora rules cover the
              first 8; the remaining 4 are property-based only.
            </p>
            <CodeBlock
              lang="solidity"
              filename="test/invariants/VaultInvariants.t.sol"
              code={`function invariant_principalMatchesTotal() public {
    uint256 sum;
    for (uint256 i; i < handler.ghostSubscribersLength(); ++i) {
        address u = handler.ghostSubscribers(i);
        sum += vault.principalOf(u);
    }
    assertEq(sum, vault.totalSubscribed(), "INV-01");
}

function invariant_weightMatchesTotal() public {
    uint256 sum;
    for (uint256 i; i < handler.ghostSubscribersLength(); ++i) {
        sum += vault.weightOf(handler.ghostSubscribers(i));
    }
    assertEq(sum, vault.totalWeight(), "INV-02");
}

function invariant_boostBounded() public view {
    assertLe(booster.boostOf(handler.currentActor()), 30_000, "INV-06");
}`}
            />
            <p>
              The full list — <code>INV-01</code> through{" "}
              <code>INV-12</code> — is enumerated in the{" "}
              <a href="/docs/contracts#invariants">contract reference</a>.
              Certora formal-spec proofs published in the{" "}
              <a href="/audits">audits</a> archive.
            </p>

            <H2 id="threat">Threat model</H2>
            <p>
              RPO is exposed to five classes of adversary. For each we
              specify the mitigation and residual risk.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Threat</th>
                  <th>Mitigation</th>
                  <th>Residual</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Malicious governance proposal</td>
                  <td>48h timelock, narrow scope, hard-coded refund logic</td>
                  <td>Low — users can exit during the timelock</td>
                </tr>
                <tr>
                  <td>Front-run on fulfillment</td>
                  <td>Commit-reveal fill price, Chainlink guard band</td>
                  <td>Low — capped at 30bps</td>
                </tr>
                <tr>
                  <td>Keeper censoring fulfill()</td>
                  <td>Permissionless fulfill() after 1h grace</td>
                  <td>Very low</td>
                </tr>
                <tr>
                  <td>Chainlink oracle failure</td>
                  <td>Falls back to Rialto propAMM TWAP, freezes fulfill above 60bps deviation</td>
                  <td>Medium — vault can be refunded</td>
                </tr>
                <tr>
                  <td>Robinhood Chain sequencer downtime</td>
                  <td>7-day L1 escape hatch; deadlines have 24h buffer</td>
                  <td>Very low</td>
                </tr>
              </tbody>
            </table>

            <H2 id="disclosure">Responsible disclosure</H2>
            <p>
              Please report security issues via{" "}
              <a href="https://immunefi.com/bounty/rpo">Immunefi</a> or{" "}
              <a href="mailto:security@rpo.xyz">security@rpo.xyz</a> (PGP key{" "}
              <code>0xA1B2 C3D4 E5F6</code>). We commit to:
            </p>
            <ul>
              <li>Acknowledging within 24 hours.</li>
              <li>Providing a patch or mitigation timeline within 72 hours.</li>
              <li>Public disclosure at 90 days or fix + 30 days, whichever comes first.</li>
              <li>Safe-harbor for good-faith research per the{" "}
                <a href="https://immunefi.com/rpo/safe-harbor">Immunefi safe-harbor v2</a>.
              </li>
            </ul>
          </Prose>
        </div>
      </section>
    </MarketingShell>
  );
}
