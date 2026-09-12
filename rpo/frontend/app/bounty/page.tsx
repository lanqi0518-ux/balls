import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";
import { Prose } from "@/components/ui/Prose";
import { H2 } from "@/components/ui/H";

export const metadata = {
  title: "Bug bounty",
  description:
    "RPO is pre-launch. A paid bounty program will be announced alongside mainnet. Report suspected issues via GitHub security advisories in the meantime.",
};

const REPO_URL = "https://github.com/lanqi0518-ux/balls";
const ADVISORIES_URL = `${REPO_URL}/security/advisories/new`;

export default function BountyPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Bug bounty"
        title="No paid program yet — please still report."
        description="RPO has not launched. A structured, paid bug bounty will be announced with mainnet, once contracts are audited and deployed. Until then, please still report suspected vulnerabilities privately."
      />

      <section className="section">
        <div className="container-wide">
          <div className="card p-8 space-y-4">
            <Badge variant="peach">Pre-launch</Badge>
            <h2 className="font-display text-2xl text-ink-900">
              How to report today
            </h2>
            <ul className="text-sm text-ink-500 space-y-2 leading-relaxed list-disc pl-5">
              <li>
                File a private{" "}
                <a
                  href={ADVISORIES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-forest-500 hover:underline"
                >
                  GitHub security advisory
                </a>{" "}
                on the repository.
              </li>
              <li>
                Do not open a public issue and do not share exploit details
                in public channels.
              </li>
              <li>
                We will coordinate a fix and disclosure timeline with the
                reporter directly.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide max-w-4xl">
          <Prose>
            <H2 id="future">What the paid program will look like</H2>
            <p>
              When the paid bounty launches with mainnet, this page will
              publish scope, severity tiers, payout amounts, safe-harbor
              terms, and the disclosure SLA. All of that requires deployed
              contracts and completed audits first.
            </p>
            <H2 id="scope">Expected in-scope surface (post-launch)</H2>
            <ul>
              <li>
                Deployed protocol contracts and any officially published
                periphery.
              </li>
              <li>Official RPO frontends and API endpoints, once live.</li>
              <li>The published SDK, once released.</li>
            </ul>
            <H2 id="out">Expected out-of-scope</H2>
            <ul>
              <li>
                Robinhood Chain sequencer and infrastructure — report those
                to the chain operator directly.
              </li>
              <li>Third-party wallets, RPC providers, and end-user devices.</li>
              <li>DoS via chain congestion.</li>
              <li>UX bugs that do not compromise funds.</li>
            </ul>
          </Prose>
        </div>
      </section>

      <section className="section border-t border-line">
        <div className="container-wide">
          <div className="card-dark p-10 flex items-center justify-between gap-6 flex-wrap">
            <div>
              <Badge variant="peach">Report</Badge>
              <div className="font-display text-3xl mt-3">
                Found something now? Please still report it.
              </div>
              <div className="text-sm text-white/70 mt-2 max-w-xl">
                Even without a paid program, we want to know. File a private
                GitHub security advisory on the repository.
              </div>
            </div>
            <div className="flex gap-3">
              <a
                href={ADVISORIES_URL}
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-sm bg-peach-500 hover:bg-peach-600"
              >
                Open a private advisory <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="btn text-sm border border-white/20 hover:border-white text-white rounded-full px-5 py-2.5"
              >
                GitHub repo
              </a>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
