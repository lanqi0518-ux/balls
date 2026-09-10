import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";

export const metadata = {
  title: "Ecosystem",
  description:
    "Protocol dependencies RPO is designed to compose with, and integrations planned for launch.",
};

const CATS = [
  {
    title: "Oracle",
    items: [
      {
        name: "Chainlink Total-Return Feeds",
        role: "Canonical USDG-denominated mark for every Stock Token.",
        version: "AggregatorV3Interface · TR feed",
        docs: "https://docs.chain.link/data-feeds",
      },
    ],
  },
  {
    title: "Fill venues",
    items: [
      {
        name: "Rialto propAMM",
        role: "Primary fill venue for SubscriptionVault.fulfill().",
        version: "propAMM · IRialtoRouter",
        docs: "https://rialto.finance/docs",
      },
      {
        name: "Uniswap V4",
        role: "Fallback route when Chainlink deviates > 30 bps from Rialto quote.",
        version: "Universal Router · PoolManager",
        docs: "https://docs.uniswap.org/contracts/v4/overview",
      },
    ],
  },
  {
    title: "Money markets",
    items: [
      {
        name: "Aave v3",
        role: "Idle USDG in SubscriptionVault earns supply APY during the subscription window.",
        version: "Pool v3 · USDG receipt aUSDG",
        docs: "https://docs.aave.com/developers",
      },
      {
        name: "Morpho Blue",
        role: "Isolated dTOKEN/USDG markets for LeverageLooper.",
        version: "MorphoBlue v1 — isolated markets per stock token",
        docs: "https://docs.morpho.org/morpho/overview",
      },
    ],
  },
  {
    title: "Cross-chain",
    items: [
      {
        name: "LiFi Diamond",
        role: "USDC → USDG bridge in the subscribe widget, single-tx UX.",
        version: "LiFiDiamond v2",
        docs: "https://docs.li.fi/",
      },
    ],
  },
  {
    title: "Launchpad",
    items: [
      {
        name: "Pons",
        role: "$RPO is designed to fair-launch on Pons; RPO/SPY pool will be the canonical trading venue.",
        version: "Pons bonding curve → Uniswap V4 graduation (LP burned)",
        docs: "https://pons.dev/docs",
      },
    ],
  },
  {
    title: "Standards",
    items: [
      {
        name: "ERC-8056 Scaled UI",
        role: "uiMultiplier() reads splits / cash-adjust events natively.",
        version: "Draft 8056 — target for every RHJ Stock Token",
        docs: "https://eips.ethereum.org/EIPS/eip-8056",
      },
      {
        name: "ERC-20 Votes",
        role: "$RPO snapshot voting weight for Governor.",
        version: "OpenZeppelin @5.0 ERC20Votes",
        docs: "https://docs.openzeppelin.com/contracts/5.x/api/token/erc20",
      },
    ],
  },
];

export default function EcosystemPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Ecosystem"
        title="Built on primitives that already work."
        description="RPO is designed as a thin wrapper on top of the best on-chain primitives Ethereum has produced. Every dependency below is enumerated with the exact interface we integrate against. Deployed addresses will be published on the Docs → Contracts page once mainnet is live."
      />

      <section className="section">
        <div className="container-wide">
          <div className="card p-6 border-l-4 border-peach-500 bg-peach-50/40">
            <Badge variant="peach">Pre-launch</Badge>
            <p className="text-sm text-ink-500 mt-3 leading-relaxed">
              No RPO contracts are deployed yet, so none of these
              integrations are live on-chain. The list below reflects the
              intended dependency graph the protocol will ship with.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-wide space-y-14">
          {CATS.map((cat) => (
            <div key={cat.title}>
              <div className="flex items-baseline gap-3 mb-5">
                <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500 font-mono">
                  {cat.title}
                </div>
                <div className="h-px flex-1 bg-line" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {cat.items.map((it) => (
                  <div key={it.name} className="card p-6 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-semibold text-ink-900">
                          {it.name}
                        </div>
                        <div className="text-xs font-mono text-forest-500 mt-1">
                          {it.version}
                        </div>
                      </div>
                      <a
                        href={it.docs}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 flex-shrink-0"
                      >
                        Docs <ArrowUpRight className="h-3 w-3" />
                      </a>
                    </div>
                    <p className="text-sm text-ink-500 leading-relaxed">
                      {it.role}
                    </p>
                    <div className="flex items-center justify-between border-t border-line pt-4">
                      <span className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-mono">
                        Contract
                      </span>
                      <span className="font-mono text-xs text-ink-500">
                        not deployed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
