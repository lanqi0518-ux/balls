import Link from "next/link";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight, Book, Bolt, Shield, Coin } from "@/components/ui/Icons";

export const metadata = {
  title: "Documentation",
  description:
    "Integrate RPO — REST API, TypeScript SDK, and Solidity contract reference. Pre-launch — endpoints are draft targets.",
};

const CATS = [
  {
    Icon: Book,
    title: "Whitepaper",
    body: "The full technical protocol description.",
    href: "/whitepaper",
  },
  {
    Icon: Bolt,
    title: "REST API",
    body: "Planned public endpoints for reading active IPOs, subscription state, and boost multipliers.",
    href: "/docs/api",
  },
  {
    Icon: Coin,
    title: "TypeScript SDK",
    body: "@rpo/sdk (planned) — typed wrappers around every write path. wagmi-ready.",
    href: "/docs/sdk",
  },
  {
    Icon: Shield,
    title: "Contract reference",
    body: "IPORegistry, SubscriptionVault, AllocationBooster, RialtoAdapter, LeverageLooper.",
    href: "/docs/contracts",
  },
];

export default function DocsHomePage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Developers"
        title="Everything you need to build on RPO."
        description="Contracts are designed for Robinhood Chain (id 4663). Read paths will need no wallet; write paths will accept USDG on any wagmi-compatible connector."
      />

      <section className="section">
        <div className="container-wide">
          <div className="card p-6 border-l-4 border-peach-500 bg-peach-50/40">
            <Badge variant="peach">Pre-launch</Badge>
            <p className="text-sm text-ink-500 mt-3 leading-relaxed">
              RPO is not deployed on mainnet. The API endpoints, SDK npm
              package, and RPC URLs described in these docs are the target
              interface — they don&apos;t exist yet. Source of truth today
              is the{" "}
              <a
                href="https://github.com/lanqi0518-ux/balls"
                target="_blank"
                rel="noreferrer"
                className="text-forest-500 hover:underline"
              >
                GitHub repository
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-wide grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="card-hover p-6 flex flex-col gap-3 group"
            >
              <c.Icon className="h-5 w-5 text-forest-500" />
              <div className="font-semibold text-ink-900">{c.title}</div>
              <div className="text-sm text-ink-500 leading-relaxed flex-1">
                {c.body}
              </div>
              <div className="text-sm text-ink-900 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                Open <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide">
          <div className="eyebrow mb-4">Reference chain config</div>
          <h2 className="font-display text-3xl text-ink-900 mb-8">
            Robinhood Chain — the target network.
          </h2>
          <div className="card p-8 max-w-2xl">
            <div className="space-y-3 text-sm">
              {[
                { k: "Chain name", v: "Robinhood Chain" },
                { k: "Chain ID", v: "4663" },
                { k: "Public RPC", v: "https://rpc.mainnet.chain.robinhood.com" },
                { k: "Docs", v: "https://docs.robinhood.com/chain/" },
              ].map((r) => (
                <div
                  key={r.k}
                  className="flex items-center justify-between border-b border-line last:border-0 py-2 gap-4"
                >
                  <span className="text-ink-500 flex-shrink-0">{r.k}</span>
                  <span className="font-mono text-ink-900 text-xs truncate">
                    {r.v}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-xs text-ink-500 mt-6 leading-relaxed">
              RPO&apos;s deployed-contract addresses will be published on
              the Contracts reference page as soon as they land on
              Robinhood Chain.
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
