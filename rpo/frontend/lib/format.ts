export function fmtUSD(x: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    if (Math.abs(x) >= 1_000_000)
      return `$${(x / 1_000_000).toFixed(2)}M`;
    if (Math.abs(x) >= 1_000) return `$${(x / 1_000).toFixed(1)}k`;
  }
  return `$${x.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

export function fmtNum(x: number, digits = 4): string {
  return x.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function shortAddr(addr?: string | null): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function fmtCountdown(seconds: number): string {
  if (seconds <= 0) return "Closed";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function pct(a: number, b: number): number {
  if (b <= 0) return 0;
  return Math.min(100, Math.round((a / b) * 100));
}
