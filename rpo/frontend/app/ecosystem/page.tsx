import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";
import { RPO_ADDRESSES, shortAddr } from "@/lib/addresses";

export const metadata = {
  title: "Ecosystem",
  description:
    "Every protocol RPO composes with, with exact contract version and integration path.",
};

const CATS = [
  {
    title: "Oracle",
    items: [
      {
        name: "Chainlink Total-Return Feeds",
        role: "Canonical USDG-denominated mark for every Stock Token.",
        version: "AggregatorV3Interface · TR feed rev 2",
        address: RPO_ADDRESSES.external.Chainlink,
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
        version: "propAMM v1.2 · IRialtoRouter",
        address: RPO_ADDRESSES.external.Rialto,
        docs: "https://rialto.finance/docs",
      },
      {
        name: "Uniswap V4",
        role: "Fallback route when Chainlink deviates > 30 bps from Rialto quote.",
        version: "Universal Router v1.0 · PoolManager 0x…",
        address: RPO_ADDRESSES.external.Uniswap,
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
        version: "Pool v3.1 · USDG receipt aUSDG",
        address: RPO_ADDRESSES.external.Aave,
        docs: "https://docs.aave.com/developers",
      },
      {
        name: "Morpho Blue",
        role: "Isolated dTOKEN/USDG markets for LeverageLooper.",
        version: "MorphoBlue v1 · 6 markets (dSPY, dQQQ, dCORZ, dRDDT, dTSMC-2, dNVDA-B)",
        address: RPO_ADDRESSES.external.Morpho,
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
        version: "LiFiDiamond v2 · Squid + Across facets",
        address: RPO_ADDRESSES.external.LiFi,
        docs: "https://docs.li.fi/",
      },
    ],
  },
  {
    title: "Launchpad",
    items: [
      {
        name: "Pons",
        role: "$RPO fair-launched here; RPO/SPY pool is canonical trading venue.",
        version: "Pons v2 bonding curve → Uniswap V4 graduation (LP burned)",
        address: RPO_ADDRESSES.pons.RpoSpyPool,
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
        version: "Draft 8056 · used by every RHJ Stock Token",
        address: RPO_ADDRESSES.tokens.dSPY,
        docs: "https://eips.ethereum.org/EIPS/eip-8056",
      },
      {
        name: "ERC-20 Votes",
        role: "$RPO snapshot voting weight for Governor.",
        version: "OpenZeppelin @5.0 ERC20Votes",
        address: RPO_ADDRESSES.tokens.RPO,
        docs: "https://docs.openzeppelin.com/contracts/5.x/api/token/erc20",
      },
    ],
  },
];

const INTEGRATIONS = [
  { app: "Zerion", what: "Portfolio balances + Stock Token PnL" },
  { app: "DeBank", what: "Subscription positions + boost display" },
  { app: "Rabby wallet", what: "Native RH-Chain support + subscribe extension" },
  { app: "Safe (Gnosis)", what: "Vault ownership by DAO multisigs" },
  { app: "Dune", what: "dune.com/rpo — subscription volume, boost distribution" },
  { app: "Etherscan Explorer", what: "Full verified source + read/write tabs" },
];

export default function EcosystemPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Ecosystem"
        title="Built on primitives that already work."
        description="RPO is a thin wrapper on top of the best on-chain primitives Ethereum has produced. Every dependency below is enumerated with the exact contract version we integrate against."
      />

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
                      <a
                        href={`${RPO_ADDRESSES.explorer}/address/${it.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-ink-900 hover:underline"
                      >
                        {shortAddr(it.address)}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide">
          <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
            <div>
              <div className="eyebrow mb-3">Integrations</div>
              <h2 className="font-display text-3xl text-ink-900">
                Where RPO shows up.
              </h2>
            </div>
            <a
              href="/grants"
              className="text-sm text-forest-500 hover:underline"
            >
              Building an integration? Get a grant →
            </a>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {INTEGRATIONS.map((i) => (
              <div key={i.app} className="card p-5">
                <div className="font-semibold text-ink-900">{i.app}</div>
                <div className="text-sm text-ink-500 mt-1.5">{i.what}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
