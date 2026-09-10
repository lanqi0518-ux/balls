import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { RPO_ADDRESSES, shortAddr } from "@/lib/addresses";
import { ArrowUpRight } from "@/components/ui/Icons";

export const metadata = {
  title: "Explorer",
  description:
    "RPO is pre-launch. No SubscriptionVaults have been deployed yet — this explorer will index them from the on-chain IPORegistry once the protocol goes live.",
};

const REPO_URL = "https://github.com/lanqi0518-ux/balls";

export default function ExplorerPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Explorer"
        title="No vaults deployed yet."
        description="The Explorer will index every SubscriptionVault emitted by IPORegistry, in real time, once mainnet is live. Nothing is deployed yet, so there are no vaults, no subscriptions, and no realized returns to display."
      />

      <section className="section">
        <div className="container-wide">
          <div className="card p-8 space-y-4">
            <Badge variant="peach">Pre-launch</Badge>
            <h2 className="font-display text-2xl text-ink-900">
              What this page will show once mainnet is live
            </h2>
            <ul className="text-sm text-ink-500 space-y-2 leading-relaxed list-disc pl-5">
              <li>
                One row per <code>SubscriptionVault</code> emitted by{" "}
                <code>IPORegistry</code> and <code>AssetDiscovery</code>.
              </li>
              <li>Live subscription status, subscribed vs target, subscriber count.</li>
              <li>Fulfilled vaults with Chainlink-tracked realized returns.</li>
              <li>Direct links to the deployed vault contract on the Robinhood Chain block explorer.</li>
            </ul>

            <div className="grid md:grid-cols-2 gap-4 mt-2">
              <div className="rounded-xl border border-line bg-paper-100 p-5">
                <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500 mb-2 font-mono">
                  Chain
                </div>
                <div className="text-ink-900">
                  {RPO_ADDRESSES.chainName} · id {RPO_ADDRESSES.chainId}
                </div>
              </div>
              <div className="rounded-xl border border-line bg-paper-100 p-5">
                <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500 mb-2 font-mono">
                  Registry
                </div>
                <div className="text-ink-900 font-mono text-sm">
                  {shortAddr(RPO_ADDRESSES.contracts.IPORegistry)}
                </div>
              </div>
            </div>

            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-primary text-sm inline-flex w-fit mt-2"
            >
              View the source
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
