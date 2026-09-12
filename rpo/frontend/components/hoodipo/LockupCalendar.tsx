import type { RecentIpo } from "@/lib/ipos/recent";

/**
 * Approximate insider-lockup expiries for recent IPOs. Underwriter-
 * standard lockup is 180 days from first-trade date; SPAC lockups are
 * usually 180 days from business-combination close. Where a company
 * publicly announced an early lockup release we override that below.
 *
 * Nothing on this page is a live oracle read — the LockupHedgeVault
 * primitive itself accepts a per-position `lockupExpiry` at open()
 * so users can override this table.
 */

const OVERRIDES: Record<string, string> = {
  RIVN: "2022-05-08", // Rivian public early-release
  COIN: "2021-10-14", // COIN direct listing had no lockup, N/A
  RDDT: "2024-09-17",
  ALAB: "2024-09-16",
};

function estimateLockup(listingDate: string, ticker: string): string {
  if (OVERRIDES[ticker]) return OVERRIDES[ticker];
  const d = new Date(listingDate);
  d.setDate(d.getDate() + 180);
  return d.toISOString().slice(0, 10);
}

export function LockupCalendar({ ipos }: { ipos: RecentIpo[] }) {
  const now = Date.now();
  const rows = ipos
    .map((ipo) => {
      const expiry = estimateLockup(ipo.listingDate, ipo.ticker);
      const days = Math.round((new Date(expiry).getTime() - now) / 86400_000);
      return { ...ipo, expiry, days };
    })
    .sort((a, b) => a.days - b.days);

  return (
    <div className="card-soft overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-paper-100">
            <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
              Ticker
            </th>
            <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
              Listed
            </th>
            <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
              Lockup expiry (est.)
            </th>
            <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
              Status
            </th>
            <th className="text-right px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
              Source
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ticker} className="border-b border-line last:border-0">
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-ink-900 text-white text-[10px] font-bold flex items-center justify-center">
                    {r.ticker}
                  </div>
                  <div>
                    <div className="text-ink-900 font-semibold">d{r.ticker}</div>
                    <div className="text-[11px] text-ink-500 truncate max-w-[220px]">
                      {r.company}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4 text-ink-500 font-mono text-xs">
                {r.listingDate}
              </td>
              <td className="px-5 py-4 text-ink-900 font-mono text-xs">
                {r.expiry}
              </td>
              <td className="px-5 py-4">
                {r.days < 0 ? (
                  <span className="text-[11px] uppercase tracking-[0.18em] text-ink-500 font-mono">
                    Expired {Math.abs(r.days)}d ago
                  </span>
                ) : r.days < 30 ? (
                  <span className="text-[11px] uppercase tracking-[0.18em] text-peach-500 font-mono">
                    ≤ {r.days}d — hedge now
                  </span>
                ) : (
                  <span className="text-[11px] uppercase tracking-[0.18em] text-forest-500 font-mono">
                    {r.days}d away
                  </span>
                )}
              </td>
              <td className="px-5 py-4 text-right">
                <a
                  href={r.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-ink-500 hover:text-ink-900 font-mono"
                >
                  SEC ↗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
