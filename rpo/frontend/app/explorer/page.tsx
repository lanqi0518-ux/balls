import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { RPO_ADDRESSES, shortAddr } from "@/lib/addresses";
import { readAllStockSnapshots, readNetworkStatus } from "@/lib/robinhood/reads";
import { fmtNum, fmtUSD } from "@/lib/format";
import { ArrowUpRight } from "@/components/ui/Icons";

export const metadata = {
  title: "Explorer",
  description:
    "Live index of already-listed Robinhood Chain Stock Tokens (aftermarket underlying an RPO AftermarketVault fills against) plus the RPO contract registry.",
};

const REPO_URL = "https://github.com/lanqi0518-ux/balls";
const EXPLORER_BASE = "https://robinscan.com/address/";

// Live on-chain data — refresh every minute so the page always shows a
// current Chainlink mark without hammering the RPC.
export const revalidate = 60;

export default async function ExplorerPage() {
  const [snapshots, net] = await Promise.all([
    readAllStockSnapshots(),
    readNetworkStatus(),
  ]);
  const liveTokens = snapshots.filter((s) => s.priceUsd != null);

  return (
    <MarketingShell>
      <PageHero
        eyebrow="Explorer · live"
        title="Every already-listed Robinhood-Chain Stock Token, priced by Chainlink."
        description="This page reads Robinhood Chain directly. The Stock Tokens listed here are aftermarket underlying — already-public stocks and ETFs Robinhood has minted onto RH Chain as Reg-S tokens, not new IPOs. An RPO AftermarketVault will fill subscriptions against them through Rialto propAMM. RPO vaults themselves are not yet deployed — their section stays honest and empty until they are."
      />

      <section className="section">
        <div className="container-wide space-y-8">
          {/* Network status */}
          <div className="grid md:grid-cols-4 gap-4">
            <StatCard
              label="Chain"
              value={net.chainName}
              hint={`id ${net.chainId}`}
            />
            <StatCard
              label="Latest block"
              value={
                net.blockNumber != null
                  ? fmtNum(Number(net.blockNumber), 0)
                  : "—"
              }
              hint={net.blockNumber != null ? "RPC live" : "RPC unreachable"}
            />
            <StatCard
              label="USDG total supply"
              value={
                net.usdgSupply != null
                  ? net.usdgSupply >= 1_000_000
                    ? `$${(net.usdgSupply / 1_000_000).toFixed(2)}M`
                    : `$${fmtNum(net.usdgSupply, 0)}`
                  : "—"
              }
              hint="canonical Global Dollar"
            />
            <StatCard
              label="Stock Tokens indexed"
              value={`${liveTokens.length} / ${snapshots.length}`}
              hint="verified onchain"
            />
          </div>

          {/* Stock tokens */}
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-5 border-b border-line flex items-center justify-between">
              <div>
                <div className="eyebrow">Robinhood Chain · Aftermarket Stock Tokens</div>
                <div className="text-ink-500 text-sm mt-1">
                  Every entry below is a real ERC-20 with a real Chainlink
                  price feed — an already-listed public equity Robinhood
                  has minted onto RH Chain. Data refreshes every 60 seconds.
                </div>
              </div>
              <Badge variant="forest" dot>
                Live RPC
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-ink-500 bg-paper-100">
                    <th className="px-6 py-3 font-medium">Token</th>
                    <th className="px-6 py-3 font-medium">Mark</th>
                    <th className="px-6 py-3 font-medium">On-chain supply</th>
                    <th className="px-6 py-3 font-medium">Market value</th>
                    <th className="px-6 py-3 font-medium">Address</th>
                    <th className="px-6 py-3 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((s) => {
                    const mktCap =
                      s.priceUsd != null && s.totalSupply != null
                        ? s.priceUsd * s.totalSupply
                        : null;
                    return (
                      <tr
                        key={s.token.ticker}
                        className="border-t border-line hover:bg-paper-50"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-ink-900">
                            {s.token.ticker}
                          </div>
                          <div className="text-xs text-ink-500">
                            {s.token.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono tabular-nums">
                          {s.priceUsd != null ? fmtUSD(s.priceUsd) : "—"}
                        </td>
                        <td className="px-6 py-4 font-mono tabular-nums">
                          {s.totalSupply != null
                            ? fmtNum(s.totalSupply, 0)
                            : "—"}
                        </td>
                        <td className="px-6 py-4 font-mono tabular-nums">
                          {mktCap != null
                            ? mktCap >= 1_000_000
                              ? `$${(mktCap / 1_000_000).toFixed(2)}M`
                              : mktCap >= 1_000
                              ? `$${(mktCap / 1_000).toFixed(1)}k`
                              : fmtUSD(mktCap)
                            : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <a
                            href={`${EXPLORER_BASE}${s.token.address}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-forest-500 hover:underline font-mono text-xs inline-flex items-center gap-1"
                          >
                            {s.token.address.slice(0, 8)}…
                            {s.token.address.slice(-4)}
                            <ArrowUpRight className="h-3 w-3" />
                          </a>
                        </td>
                        <td className="px-6 py-4">
                          {s.token.priceFeed ? (
                            <a
                              href={`${EXPLORER_BASE}${s.token.priceFeed}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-forest-500 hover:underline font-mono text-xs inline-flex items-center gap-1"
                              title="Chainlink AggregatorV3 feed"
                            >
                              {s.token.priceFeed.slice(0, 8)}…
                              {s.token.priceFeed.slice(-4)}
                              <ArrowUpRight className="h-3 w-3" />
                            </a>
                          ) : (
                            <span
                              className="font-mono text-xs text-ink-500"
                              title="Reference price comes from the Uniswap V4 pool mid"
                            >
                              V4 pool mid
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* RPO vaults section — honestly empty until deploy */}
          <div className="card p-8 space-y-4 border-l-4 border-peach-500 bg-peach-50/40">
            <Badge variant="peach">Pre-launch</Badge>
            <h2 className="font-display text-2xl text-ink-900">
              RPO SubscriptionVaults — none deployed yet
            </h2>
            <p className="text-sm text-ink-500 leading-relaxed">
              The RPO subscription layer (
              <code>{shortAddr(RPO_ADDRESSES.contracts.IPORegistry)}</code>{" "}
              on {RPO_ADDRESSES.chainName}) has not been deployed. Once{" "}
              <code>IPORegistry</code> is live, every emitted vault will be
              indexed here alongside the underlying Stock Token above.
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-primary text-sm inline-flex w-fit"
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

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="card p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500 mb-2 font-mono">
        {label}
      </div>
      <div className="text-2xl text-ink-900 font-mono tabular-nums">
        {value}
      </div>
      <div className="text-xs text-ink-500 mt-2">{hint}</div>
    </div>
  );
}
