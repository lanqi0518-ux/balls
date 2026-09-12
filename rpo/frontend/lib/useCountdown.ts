"use client";

import { useEffect, useState } from "react";

/** Real-time ticking countdown. Returns remaining seconds (>= 0). */
export function useCountdown(targetMs: number): number {
  const [now, setNow] = useState(() =>
    typeof window === "undefined" ? targetMs : Date.now()
  );

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return Math.max(0, Math.floor((targetMs - now) / 1000));
}
