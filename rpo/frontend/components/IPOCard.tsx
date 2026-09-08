import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";

type IPOCardProps = {
  ticker: string;
  name: string;
  logoUrl?: string;
  subscribedUSD: number;
  targetUSD: number;
  expectedPrice?: number;
  countdownSec: number;
  boost: number;
  status?: "Subscribing" | "Announced" | "Fulfilled" | "Refunded";
};

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Closed";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function fmtM(x: number): string {
  return `$${(x / 1_000_000).toFixed(2)}M`;
}

export function IPOCard({
  ticker,
  name,
  logoUrl,
  subscribedUSD,
  targetUSD,
  expectedPrice,
  countdownSec,
  boost,
  status = "Subscribing",
}: IPOCardProps) {
  const pct = Math.min(100, Math.round((subscribedUSD / targetUSD) * 100));

  return (
    <Link
      href={`/app/ipo/${ticker.toLowerCase()}`}
      className="card-hover p-7 flex flex-col gap-5 group"
    >
      <div className="flex items-center gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={ticker}
            className="w-12 h-12 rounded-2xl border border-line"
          />
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 flex items-center justify-center text-white font-semibold">
            {ticker.slice(0, 2)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold text-ink-900">{ticker}</div>
          <div className="text-xs text-ink-500 truncate">{name}</div>
        </div>
        <Badge
          variant={status === "Subscribing" ? "forest" : "default"}
          dot={status === "Subscribing"}
        >
          {status}
        </Badge>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-ink-500 mb-2">
          <span>Subscribed</span>
          <span className="font-mono text-ink-900 tabular-nums">
            {fmtM(subscribedUSD)} / {fmtM(targetUSD)}
          </span>
        </div>
        <div className="h-1.5 bg-paper-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-forest-500 to-peach-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 border-t border-line pt-4 gap-3">
        <MiniStat
          k="Expected"
          v={expectedPrice ? `$${expectedPrice.toFixed(2)}` : "TBD"}
        />
        <MiniStat
          k="Launch in"
          v={formatCountdown(countdownSec)}
          tone="forest"
        />
        <MiniStat k="Boost" v={`${boost.toFixed(1)}×`} tone="peach" />
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-ink-500">
          {pct}% filled · vault #{ticker}
        </span>
        <span className="text-sm text-ink-900 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
          Subscribe <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function MiniStat({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: "forest" | "peach";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500">
        {k}
      </div>
      <div
        className={
          "text-sm font-mono tabular-nums mt-1 " +
          (tone === "forest"
            ? "text-forest-500 font-semibold"
            : tone === "peach"
            ? "text-peach-600 font-semibold"
            : "text-ink-900")
        }
      >
        {v}
      </div>
    </div>
  );
}
