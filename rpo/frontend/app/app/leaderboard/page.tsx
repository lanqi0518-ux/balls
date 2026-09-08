import { Badge } from "@/components/ui/Badge";
import { Trophy } from "@/components/ui/Icons";

const LEADERS = [
  { rank: 1, addr: "0x8f2a…3c91", volume: 412_400, ipos: 12, pnl: 21.4, boost: 2.9 },
  { rank: 2, addr: "0x2b40…7dea", volume: 318_120, ipos: 11, pnl: 18.1, boost: 2.7 },
  { rank: 3, addr: "0x91cd…0e14", volume: 292_800, ipos: 10, pnl: 14.6, boost: 2.5 },
  { rank: 4, addr: "0x5540…22a1", volume: 210_400, ipos: 9, pnl: 12.9, boost: 2.4 },
  { rank: 5, addr: "0xac00…9088", volume: 180_020, ipos: 8, pnl: 10.2, boost: 2.2 },
  { rank: 6, addr: "0x670f…dd12", volume: 172_450, ipos: 8, pnl: 8.4, boost: 2.1 },
  { rank: 7, addr: "0xfe32…4567", volume: 154_200, ipos: 7, pnl: 6.9, boost: 2.0 },
  { rank: 8, addr: "0x18cc…dead", volume: 140_800, ipos: 7, pnl: 5.5, boost: 1.9 },
  { rank: 9, addr: "0x7770…beef", volume: 128_900, ipos: 6, pnl: 4.1, boost: 1.7 },
  { rank: 10, addr: "0xdead…c0de", volume: 112_120, ipos: 6, pnl: 3.2, boost: 1.6 },
];

export default function LeaderboardPage() {
  return (
    <div className="p-5 lg:p-10 max-w-6xl">
      <header className="mb-10 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow mb-3">Season 1</div>
          <h1 className="font-display text-4xl lg:text-5xl text-fg">
            Leaderboard
          </h1>
          <p className="mt-3 text-fg-muted max-w-xl">
            Top subscribers by cumulative volume. Season 1 ends when the
            protocol crosses $50M cumulative volume — top 50 wallets earn a
            weighted $RPO airdrop.
          </p>
        </div>
        <Badge variant="forest" dot>
          Season active · 8.4M / 50M
        </Badge>
      </header>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-12 items-center px-5 py-4 text-xs uppercase tracking-[0.14em] text-fg-dim border-b border-line">
          <div className="col-span-1">Rank</div>
          <div className="col-span-4">Wallet</div>
          <div className="col-span-2 text-right">Volume</div>
          <div className="col-span-1 text-right">IPOs</div>
          <div className="col-span-2 text-right">Realized PnL</div>
          <div className="col-span-2 text-right">Boost</div>
        </div>
        {LEADERS.map((l) => (
          <div
            key={l.rank}
            className="grid grid-cols-12 items-center px-5 py-4 border-b border-line last:border-0 hover:bg-paper-100 transition-colors"
          >
            <div className="col-span-1">
              {l.rank <= 3 ? (
                <div
                  className={
                    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold " +
                    (l.rank === 1
                      ? "bg-forest-50 text-forest-500"
                      : "bg-paper-200 text-fg")
                  }
                >
                  <Trophy className="h-3.5 w-3.5" />
                </div>
              ) : (
                <div className="text-fg-muted font-mono">#{l.rank}</div>
              )}
            </div>
            <div className="col-span-4 font-mono text-sm text-fg">
              {l.addr}
            </div>
            <div className="col-span-2 text-right font-mono text-sm text-fg tabular-nums">
              ${l.volume.toLocaleString()}
            </div>
            <div className="col-span-1 text-right font-mono text-sm text-fg-muted">
              {l.ipos}
            </div>
            <div className="col-span-2 text-right font-mono text-sm text-forest-500 tabular-nums">
              +{l.pnl}%
            </div>
            <div className="col-span-2 text-right font-mono text-sm text-fg tabular-nums">
              {l.boost.toFixed(1)}×
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-xs text-fg-dim">
        Updated every block. Only wallets that pass the sybil filter (unique
        entropy on subscription tx graph) count toward the airdrop
        distribution.
      </div>
    </div>
  );
}
