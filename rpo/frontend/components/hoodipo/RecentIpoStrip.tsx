import Link from "next/link";
import type { RecentIpo } from "@/lib/ipos/recent";
import { ArrowUpRight } from "@/components/ui/Icons";

/**
 * Read-only strip of recent, real IPOs whose tickers are already
 * tokenised on Robinhood Chain. Powers the "reference" section on
 * primitive pages ("Here's what a live pot could have caught").
 */
export function RecentIpoStrip({ ipos }: { ipos: RecentIpo[] }) {
  if (ipos.length === 0) {
    return (
      <div className="card-soft p-6 text-sm text-ink-500">
        No recent-IPO tickers in the registry yet.
      </div>
    );
  }
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {ipos.map((ipo) => (
        <div
          key={ipo.ticker}
          className="card-soft p-6 flex flex-col hover:shadow-card transition-shadow"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="h-11 w-11 rounded-2xl bg-ink-900 text-white font-bold text-xs flex items-center justify-center">
              {ipo.ticker}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink-900 truncate">
                {ipo.company}
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">
                {ipo.exchange} · {ipo.listingType} · {ipo.listingDate}
              </div>
            </div>
          </div>
          <div className="text-xs text-ink-500 leading-relaxed flex-1">
            {ipo.pitch}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Link
              href={`/app/markets/${ipo.ticker.toLowerCase()}`}
              className="text-xs text-ink-900 font-semibold inline-flex items-center gap-1 hover:underline"
            >
              Live aftermarket
              <ArrowUpRight className="h-3 w-3" />
            </Link>
            <a
              href={ipo.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-ink-500 ml-auto hover:text-ink-900"
            >
              SEC EDGAR ↗
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
