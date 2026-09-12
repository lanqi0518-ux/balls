import Link from "next/link";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Prose } from "@/components/ui/Prose";
import { H2 } from "@/components/ui/H";
import { Badge } from "@/components/ui/Badge";
import { Shield, Lock, Check, ArrowUpRight } from "@/components/ui/Icons";

export const metadata = {
  title: "Security",
  description:
    "RPO is pre-launch. Design goals: non-upgradable contracts, permissionless refunds, published audits before mainnet.",
};

const PILLARS = [
  {
    Icon: Lock,
    title: "Non-upgradable by design",
    body: "Contracts are written without proxies and without an admin key that can pause, drain, or migrate user funds. This is a code review invariant — verify it yourself in the repo.",
  },
  {
    Icon: Shield,
    title: "Permissionless refunds by design",
    body: "If a vault fails to fulfill by its deadline, anyone — not just the subscriber — can trigger a 100% refund. Enforced at the contract level, not by an operator promise.",
  },
  {
    Icon: Check,
    title: "Audits before mainnet",
    body: "No mainnet deployment happens until third-party smart-contract audits are complete and their full reports are published on the Audits page.",
  },
];

const REPO_URL = "https://github.com/lanqi0518-ux/balls";

export default function SecurityPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Security"
        title="Minimize trust. Publish everything."
        description="RPO is pre-launch. The security posture below describes the design intent embedded in the code — not a live production audit trail."
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
          <div className="eyebrow mb-4">Pre-launch status</div>
          <h2 className="font-display text-3xl text-ink-900 mb-6">
            What is and isn&apos;t live today.
          </h2>
          <div className="card divide-y divide-line">
            {[
              { label: "Contracts audited", status: "Not yet", tone: "peach" as const },
              { label: "Mainnet deployment", status: "Not deployed", tone: "peach" as const },
              { label: "Bug bounty program", status: "Not launched", tone: "peach" as const },
              { label: "Public source code", status: "Available", tone: "forest" as const },
              { label: "Foundry unit tests", status: "In repo — run locally", tone: "forest" as const },
              { label: "GitHub security advisories", status: "Accepting reports", tone: "forest" as const },
            ].map((c) => (
              <div
                key={c.label}
                className="flex items-center justify-between p-5"
              >
                <div className="text-ink-900 font-medium">{c.label}</div>
                <Badge variant={c.tone} dot>
                  {c.status}
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
                No audits published yet. When third-party audits complete, the
                full reports will be posted here with remediation status per
                finding.
              </div>
            </div>
            <div className="text-sm text-ink-900 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
              See audits page <ArrowUpRight className="h-3.5 w-3.5" />
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
                No paid bounty program is live. Report suspected
                vulnerabilities via GitHub security advisories in the
                meantime.
              </div>
            </div>
            <div className="text-sm text-ink-900 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
              See bounty page <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        </div>
      </section>

      <section className="section-tight border-t border-line">
        <div className="container-wide max-w-4xl">
          <Prose>
            <H2 id="disclosure">Responsible disclosure</H2>
            <p>
              Please report suspected security issues privately through GitHub
              security advisories on the{" "}
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                repository
              </a>
              . Do not open a public issue, and do not include exploit
              details in public channels.
            </p>
            <p>
              We commit to acknowledging good-faith reports promptly and
              coordinating a fix and disclosure timeline with the reporter.
              A paid bounty program will be announced alongside mainnet.
            </p>

            <H2 id="verify">Verify for yourself</H2>
            <ul>
              <li>
                Clone{" "}
                <a href={REPO_URL} target="_blank" rel="noreferrer">
                  the repository
                </a>{" "}
                and run <code>forge test -vv</code>.
              </li>
              <li>
                Read <code>contracts/src</code>. There are no proxies. There
                is no owner-controlled kill switch on user funds.
              </li>
              <li>
                Once contracts are deployed, verified source on the block
                explorer will be linked from every product surface.
              </li>
            </ul>
          </Prose>
        </div>
      </section>
    </MarketingShell>
  );
}
