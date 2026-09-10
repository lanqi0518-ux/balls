import Link from "next/link";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";

export const metadata = {
  title: "Audits",
  description:
    "RPO is pre-launch. No third-party audits have been completed yet. This page will publish the full reports as they land.",
};

const REPO_URL = "https://github.com/lanqi0518-ux/balls";

export default function AuditsPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Audits"
        title="No audits published yet."
        description="RPO has not launched. Third-party security audits are a hard prerequisite to any mainnet deployment. When reports land, we publish the complete PDF plus the remediation commits — not a marketing summary."
      />

      <section className="section">
        <div className="container-wide">
          <div className="card p-8 space-y-4">
            <Badge variant="peach">Pre-launch</Badge>
            <h2 className="font-display text-2xl text-ink-900">
              Current status
            </h2>
            <ul className="text-sm text-ink-500 space-y-2 leading-relaxed list-disc pl-5">
              <li>
                No paid audits have been commissioned or completed on the
                current contract set.
              </li>
              <li>
                No mainnet contracts have been deployed. Contract addresses on
                this site read from environment variables and remain
                zero-address until a real deployment is announced.
              </li>
              <li>
                Source is public on{" "}
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-forest-500 hover:underline"
                >
                  GitHub
                </a>
                . Anyone can review, reproduce builds, and open issues.
              </li>
              <li>
                Vulnerability reports should be filed as GitHub security
                advisories (see the{" "}
                <Link href="/security" className="text-forest-500 hover:underline">
                  Security
                </Link>{" "}
                page).
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide">
          <div className="eyebrow mb-4">What we plan to publish here</div>
          <h2 className="font-display text-3xl text-ink-900 mb-6">
            Once real audits are complete.
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                title: "Full audit reports",
                body: "Complete PDF for every engagement — no cherry-picked highlights.",
              },
              {
                title: "Public remediation trail",
                body: "Every finding linked to a fix commit or a documented acknowledgement.",
              },
              {
                title: "Scope and commit hashes",
                body: "Exact commit SHAs audited and the diff since the audit snapshot.",
              },
              {
                title: "Reproducible builds",
                body: "Build instructions so anyone can verify the deployed bytecode matches the audited source.",
              },
            ].map((c) => (
              <div key={c.title} className="card p-6">
                <div className="font-semibold text-ink-900">{c.title}</div>
                <div className="text-sm text-ink-500 mt-2 leading-relaxed">
                  {c.body}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-sm text-ink-500">
            Follow progress on{" "}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="text-forest-500 hover:underline inline-flex items-center gap-1"
            >
              GitHub
              <ArrowUpRight className="h-3 w-3" />
            </a>
            .
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
