import { Container } from "@/components/ui/Container";
import {
  readAllStockSnapshots,
  readNetworkStatus,
} from "@/lib/robinhood/reads";
import { readGlobalIpoCalendar } from "@/lib/ipos/aggregate";
import { fmtNum } from "@/lib/format";

/**
 * Live Robinhood-Chain stats. Every number below is fetched fresh from
 * the RPC on every ISR revalidation (60s). Nothing is invented — when
 * the RPC is unreachable we show an em-dash instead of a fake value.
 */
export async function StatsBar() {
  const [snapshots, net, ipoCal] = await Promise.all([
    readAllStockSnapshots(),
    readNetworkStatus(),
    readGlobalIpoCalendar(),
  ]);

  const liveTokens = snapshots.filter((s) => s.priceUsd != null).length;
  const ipoPipeline =
    ipoCal.upcoming.length + ipoCal.priced.length + ipoCal.filed.length;
  const ipoOk = ipoCal.sources.nasdaq.ok || ipoCal.sources.edgar.ok;

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
      label: "Global IPO pipeline",
      value: ipoOk ? fmtNum(ipoPipeline, 0) : "—",
      hint: ipoOk
        ? "live: Nasdaq + SEC EDGAR (S-1 + F-1)"
        : "IPO data sources unreachable",
    },
    {
      label: "Buyable on Uniswap V4",
      value: `${liveTokens} / ${snapshots.length}`,
      hint: "USDG → dSTOCK, one tx via UR",
    },
    {
      label: "Priced IPOs (last ~60d)",
      value: ipoOk ? fmtNum(ipoCal.priced.length, 0) : "—",
      hint: "shares actually priced and trading",
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
