"use client";

import type { ActivityEvent } from "@/lib/catalog";

/**
 * Continuous horizontal marquee of the latest on-chain subscribe events.
 * Purpose: prove to a first-time visitor that the protocol is alive —
 * new subscriptions are landing on the vault contracts every few seconds.
 */
export function ActivityTicker({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) return null;
  // Duplicate the list so the marquee loops seamlessly.
  const doubled = [...events, ...events];
  return (
    <div className="relative overflow-hidden border border-line rounded-2xl bg-white">
      <div className="absolute left-0 top-0 bottom-0 z-10 w-24 bg-gradient-to-r from-white to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 z-10 w-24 bg-gradient-to-l from-white to-transparent pointer-events-none" />
      <div className="flex items-center h-11">
        <div className="shrink-0 px-4 h-full flex items-center gap-2 border-r border-line bg-paper-100">
          <span className="h-1.5 w-1.5 rounded-full bg-forest-500 animate-pulse" />
          <span className="text-[11px] uppercase tracking-[0.16em] font-mono text-ink-500">
            live
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex animate-marquee whitespace-nowrap gap-8 py-3">
            {doubled.map((e, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2 text-xs shrink-0"
              >
                <span className="text-ink-500 font-mono">{e.wallet}</span>
                <span className="text-ink-500">→</span>
                <span className="text-ink-900 font-semibold">{e.ticker}</span>
                <span className="font-mono text-ink-900">
                  ${e.amountUSDG.toLocaleString()}
                </span>
                <span className="text-peach-600 font-mono">
                  {e.boost.toFixed(2)}×
                </span>
                <span className="text-ink-400 text-[10px] font-mono">
                  {formatAgo(e.agoSec)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatAgo(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}
