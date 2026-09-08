import Link from "next/link";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";

export const metadata = {
  title: "Blog",
  description: "Updates from RPO Labs — protocol notes, research, launch posts.",
};

const POSTS = [
  {
    slug: "mainnet",
    title: "RPO v1 is live on Robinhood Chain",
    excerpt:
      "The first permissionless IPO subscription protocol goes live with 5 open vaults, Rialto propAMM fills, and Trail of Bits + Spearbit audits published in full.",
    date: "March 3, 2026",
    read: "6 min",
    tag: "Launch",
  },
  {
    slug: "boost-mechanism",
    title: "Why the boost curve is a square root",
    excerpt:
      "A short tour of the math and game theory behind AllocationBooster: how sqrt(share) simultaneously rewards early stakers and stops whales from monopolizing supply.",
    date: "March 6, 2026",
    read: "9 min",
    tag: "Research",
  },
  {
    slug: "morpho-partnership",
    title: "LeverageLooper enters GA with Morpho Blue markets",
    excerpt:
      "Every filled IPO can now be collateralized against USDG on Morpho Blue in one click, and the borrowed USDG can auto-subscribe to the next vault.",
    date: "March 8, 2026",
    read: "5 min",
    tag: "Partnership",
  },
];

export default function BlogIndex() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Blog"
        title="Notes from the team."
        description="Product updates, protocol research, and the occasional deep dive."
      />

      <section className="section">
        <div className="container-wide grid gap-6">
          {POSTS.map((p, i) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className={
                "card-hover p-8 lg:p-10 flex gap-8 items-start group " +
                (i === 0 ? "border-forest-500" : "")
              }
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-4">
                  <Badge variant={i === 0 ? "forest" : "default"}>
                    {p.tag}
                  </Badge>
                  <div className="text-xs text-ink-500 font-mono">
                    {p.date} · {p.read}
                  </div>
                </div>
                <h2 className="font-display text-2xl lg:text-3xl text-ink-900 mb-3 group-hover:text-forest-500 transition-colors">
                  {p.title}
                </h2>
                <p className="text-ink-500 leading-relaxed max-w-2xl">
                  {p.excerpt}
                </p>
                <div className="mt-5 text-sm text-ink-900 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                  Read post <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide max-w-2xl">
          <div className="text-center">
            <div className="eyebrow mb-4 justify-center">Newsletter</div>
            <h2 className="font-display text-3xl text-ink-900 mb-3">
              Occasional. Never spam.
            </h2>
            <p className="text-ink-500 mb-6">
              About one email per protocol update. Unsubscribe with a click.
            </p>
            <div className="max-w-md mx-auto">
              <NewsletterForm />
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
