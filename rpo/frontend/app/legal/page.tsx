import Link from "next/link";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { ArrowUpRight } from "@/components/ui/Icons";

export const metadata = {
  title: "Legal",
  description:
    "Terms of Service, Privacy Policy, and Risk Disclosure for the RPO protocol.",
};

const DOCS = [
  {
    title: "Terms of Service",
    body: "The contract between you and RPO Labs governing use of the website, API, SDK, and interfaces.",
    href: "/legal/terms",
    updated: "Draft",
  },
  {
    title: "Privacy Policy",
    body: "What data we collect, what we don't, and who processes it.",
    href: "/legal/privacy",
    updated: "Draft",
  },
  {
    title: "Risk Disclosure",
    body: "Regulatory, market, custody, technology, and jurisdictional risks of using RPO.",
    href: "/legal/risk",
    updated: "Draft",
  },
];

export default function LegalIndexPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Legal"
        title="Read this before you subscribe."
        description="The protocol is trust-minimized, but your interaction with the interface is governed by these documents. They are written to be read — not to trap you."
      />

      <section className="section">
        <div className="container-wide grid md:grid-cols-3 gap-4">
          {DOCS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="card-hover p-8 flex flex-col gap-4 group"
            >
              <div className="text-xs uppercase tracking-[0.22em] text-ink-500 font-mono">
                Updated {d.updated}
              </div>
              <div>
                <div className="text-2xl font-display text-ink-900">
                  {d.title}
                </div>
                <div className="text-sm text-ink-500 mt-3 leading-relaxed">
                  {d.body}
                </div>
              </div>
              <div className="text-sm text-ink-900 inline-flex items-center gap-1 group-hover:gap-2 transition-all mt-auto">
                Read <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
