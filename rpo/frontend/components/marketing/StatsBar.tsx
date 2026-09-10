import { Container } from "@/components/ui/Container";
import {
  readAllStockSnapshots,
  readNetworkStatus,
} from "@/lib/robinhood/reads";
import { fmtNum } from "@/lib/format";

/**
 * Live Robinhood-Chain stats. Every number below is fetched fresh from
 * the RPC on every ISR revalidation (60s). Nothing is invented — when
 * the RPC is unreachable we show an em-dash instead of a fake value.
 */
export async function StatsBar() {
  const [snapshots, net] = await Promise.all([
    readAllStockSnapshots(),
    readNetworkStatus(),
  ]);

  const liveTokens = snapshots.filter((s) => s.priceUsd != null).length;
  const totalUnderlyingUsd = snapshots.reduce((acc, s) => {
    if (s.priceUsd == null || s.totalSupply == null) return acc;
    return acc + s.priceUsd * s.totalSupply;
  }, 0);

  const stats: Array<{ label: string; value: string; hint: string }> = [
    {
      label: "RH Chain block",
      value:
        net.blockNumber != null
          ? fmtNum(Number(net.blockNumber), 0)
          : "—",
      hint: `chain id ${net.chainId} · ${net.chainName}`,
    },
    {
      label: "USDG on RH Chain",
      value:
        net.usdgSupply != null
          ? net.usdgSupply >= 1_000_000
            ? `$${(net.usdgSupply / 1_000_000).toFixed(1)}M`
            : `$${fmtNum(net.usdgSupply, 0)}`
          : "—",
      hint: "totalSupply of canonical USDG",
    },
    {
      label: "Stock Tokens live",
      value: `${liveTokens} / ${snapshots.length}`,
      hint: "priced by Chainlink on RH Chain",
    },
    {
      label: "Underlying market value",
      value:
        totalUnderlyingUsd > 0
          ? totalUnderlyingUsd >= 1_000_000
            ? `$${(totalUnderlyingUsd / 1_000_000).toFixed(2)}M`
            : totalUnderlyingUsd >= 1_000
            ? `$${(totalUnderlyingUsd / 1_000).toFixed(1)}k`
            : `$${fmtNum(totalUnderlyingUsd, 0)}`
          : "—",
      hint: "sum(price × supply) for tracked tokens",
    },
  ];

  return (
    <section className="border-y border-line bg-paper-100">
      <Container>
        <div className="grid grid-cols-2 lg:grid-cols-4 lg:divide-x divide-line">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={
                "px-6 py-10 lg:py-14 " +
                (i >= 2 ? "border-t lg:border-t-0 border-line " : "") +
                (i > 0 ? "lg:pl-10 " : "")
              }
            >
              <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500">
                {s.label}
              </div>
              <div className="font-display text-4xl lg:text-6xl text-ink-900 tabular-nums mt-3">
                {s.value}
              </div>
              <div className="text-xs text-ink-500 mt-3">{s.hint}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
