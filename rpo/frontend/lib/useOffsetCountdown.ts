"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe countdown driven by an OFFSET (seconds from now-ish) rather
 * than an absolute target timestamp. This avoids the classic bug where
 * a static build displays "Closed" for every vault as soon as its
 * baked-in target timestamp drifts into the past.
 *
 *   - Initial value (both SSR and client mount): `initialSec`
 *   - After t seconds have elapsed on the client: `initialSec - t`
 *   - Returned value CAN go negative — callers decide how to render it
 *     ("Live now" / "Fulfilling…" / "Ended 5m ago" etc).
 *
 * No hydration mismatch: the first render on both server and client
 * returns the same `initialSec`. `Date.now()` is only read inside
 * `useEffect`, which never fires during SSR.
 */
export function useOffsetCountdown(initialSec: number): number {
  const [sec, setSec] = useState(initialSec);

  useEffect(() => {
    const mountTime = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - mountTime) / 1000;
      setSec(initialSec - elapsed);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [initialSec]);

  return sec;
}

/**
 * Human-readable countdown label. Handles positive (future), zero
 * (live), and negative (past) values.
 */
export function formatOffsetCountdown(sec: number): string {
  if (sec > 0) {
    const s = Math.floor(sec);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }
  if (sec > -60) return "Fulfilling…";
  const s = Math.floor(-sec);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${m}m ago`;
}
