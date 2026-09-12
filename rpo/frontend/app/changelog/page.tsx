import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";

export const metadata = {
  title: "Changelog",
  description:
    "RPO is pre-launch. No versioned releases have shipped yet. Follow the repository for real commit history.",
};

const REPO_URL = "https://github.com/lanqi0518-ux/balls";

export default function ChangelogPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Changelog"
        title="No releases yet."
        description="RPO has not launched. There are no versioned releases, no deployed contracts, and therefore no changelog entries to publish. When we start cutting releases, every entry will include a signed git tag, commit hash, and — for on-chain changes — a matching block-explorer verification."
      />

      <section className="section">
        <div className="container-wide max-w-3xl">
          <div className="card p-8 space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="peach">Pre-launch</Badge>
              <Badge>v0.1.0-pre</Badge>
            </div>
            <h2 className="font-display text-2xl text-ink-900">
              Real commit history lives on GitHub
            </h2>
            <p className="text-sm text-ink-500 leading-relaxed">
              Until we start tagging versioned releases, the source of truth
              for what has changed is the git log. Nothing on this page will
              retroactively invent releases that never shipped.
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-primary text-sm inline-flex w-fit"
            >
              View commits on GitHub
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide max-w-3xl">
          <div className="eyebrow mb-4">What will land here</div>
          <ul className="text-sm text-ink-500 space-y-2 leading-relaxed list-disc pl-5">
            <li>Signed git tag and full commit hash for every release.</li>
            <li>
              Channel (mainnet / testnet), scope, and any storage-layout
              migration notes.
            </li>
            <li>
              Verified source links on the deployed chain once contracts are
              published.
            </li>
            <li>Security fixes cross-linked to their audit finding, if any.</li>
          </ul>
        </div>
      </section>
    </MarketingShell>
  );
}
