import Link from "next/link";

type IPOCardProps = {
  ticker: string;
  name: string;
  logoUrl?: string;
  subscribedUSD: number;
  targetUSD: number;
  expectedPrice?: number;
  countdownSec: number;
  boost: number;
};

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Closed";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
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
}: IPOCardProps) {
  const pct = Math.min(100, Math.round((subscribedUSD / targetUSD) * 100));
  return (
    <div className="card p-6 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={ticker} className="w-12 h-12 rounded-full" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-chain-border flex items-center justify-center font-bold">
            {ticker.slice(0, 2)}
          </div>
        )}
        <div className="flex-1">
          <div className="text-xl font-bold">{ticker}</div>
          <div className="text-sm text-gray-400">{name}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Launch in</div>
          <div className="font-mono text-brand">{formatCountdown(countdownSec)}</div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>Subscribed</span>
          <span>
            ${(subscribedUSD / 1_000_000).toFixed(2)}M / ${(targetUSD / 1_000_000).toFixed(2)}M
          </span>
        </div>
        <div className="w-full h-2 bg-chain-border rounded-full mt-1 overflow-hidden">
          <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-gray-400">
          Expected price: {expectedPrice ? `$${expectedPrice.toFixed(2)}` : "TBD"}
        </span>
        <span className="text-brand">Your boost: {boost.toFixed(1)}x</span>
      </div>

      <Link
        href={`/ipo/${ticker}`}
        className="btn-primary text-center block"
      >
        Subscribe
      </Link>
    </div>
  );
}
