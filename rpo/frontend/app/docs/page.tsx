import Link from "next/link";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight, Book, Bolt, Shield, Coin } from "@/components/ui/Icons";

export const metadata = {
  title: "Documentation",
  description:
    "Integrate RPO — REST API, TypeScript SDK, and Solidity contract reference.",
};

const CATS = [
  {
    Icon: Book,
    title: "Whitepaper",
    body: "The full technical protocol description in 12 sections.",
    href: "/whitepaper",
  },
  {
    Icon: Bolt,
    title: "REST API",
    body: "Read active IPOs, subscription state and boost multipliers without a wallet.",
    href: "/docs/api",
  },
  {
    Icon: Coin,
    title: "TypeScript SDK",
    body: "@rpo/sdk — typed wrappers around every write path. wagmi-ready.",
    href: "/docs/sdk",
  },
  {
    Icon: Shield,
    title: "Contract reference",
    body: "IPORegistry, SubscriptionVault, AllocationBooster, RialtoAdapter, LeverageLooper.",
    href: "/docs/contracts",
  },
];

const QUICK = [
  {
    h: "Watch new IPOs",
    body: "GET https://api.rpo.xyz/v1/ipos?status=subscribing",
  },
  {
    h: "Subscribe with the SDK",
    body: "await rpo.vault('STRIPE').subscribe({ amount: 500n })",
  },
  {
    h: "Compute your boost",
    body: "const boost = await rpo.booster.boostOf('0xabc…')",
  },
  {
    h: "Deploy a keeper",
    body: "docker run rpo/keeper:latest --vault 0x… --rpc $RPC_URL",
  },
];

export default function DocsHomePage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Developers"
        title="Everything you need to build on RPO."
        description="Contracts are deployed on Robinhood Chain (id 4663). Read paths need no wallet; write paths accept USDG on any wagmi-compatible connector."
      />

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
          <div className="eyebrow mb-4">Quick tour</div>
          <h2 className="font-display text-3xl text-ink-900 mb-10">
            Four integrations, one afternoon.
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {QUICK.map((q) => (
              <div key={q.h} className="card p-6">
                <div className="text-sm font-semibold text-ink-900 mb-3">
                  {q.h}
                </div>
                <pre className="bg-ink-900 text-ink-100 rounded-xl p-4 text-[13px] font-mono overflow-x-auto">
                  <code>{q.body}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-wide">
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="card p-8">
              <Badge variant="forest" dot>
                RPC endpoints
              </Badge>
              <div className="mt-5 space-y-3 text-sm">
                {[
                  { k: "Public HTTP", v: "https://rpc.robinhoodchain.com" },
                  { k: "Alchemy", v: "https://rhc-mainnet.g.alchemy.com/v2/{key}" },
                  { k: "WebSocket", v: "wss://rpc.robinhoodchain.com/ws" },
                  { k: "Chain ID", v: "4663" },
                ].map((r) => (
                  <div
                    key={r.k}
                    className="flex items-center justify-between border-b border-line last:border-0 py-2"
                  >
                    <span className="text-ink-500">{r.k}</span>
                    <span className="font-mono text-ink-900 text-xs">
                      {r.v}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-8">
              <Badge variant="peach" dot>
                Subgraph
              </Badge>
              <div className="mt-5 text-sm text-ink-500 mb-4">
                RPO indexes every vault event to a public subgraph. Free tier
                is 100k queries/mo; keys are provisioned instantly.
              </div>
              <div className="rounded-xl bg-ink-900 text-ink-100 p-4 font-mono text-[13px]">
                <div className="text-ink-400">
                  # POST https://api.rpo.xyz/subgraph
                </div>
                <div className="mt-2">
                  {`{ ipos(where: {status:"Subscribing"}) { ticker target subscribed launchAt } }`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
