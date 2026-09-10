"use client";

import { useEffect, useState } from "react";
import { X } from "@/components/ui/Icons";

/**
 * Always-visible-first-load banner explaining that /app is a UX
 * preview: contracts are audited but not yet deployed to mainnet, so
 * every balance, subscription, stake, and tx hash the user sees in
 * these pages is a local simulation kept in browser storage.
 *
 * Wallet connect is real (RainbowKit + wagmi), but no on-chain calls
 * are made against the connected wallet. Once mainnet ships (target
 * Q4 2026 — see /roadmap) this banner will be removed and the store
 * will read from the real IPORegistry + AssetDiscovery contracts.
 *
 * Rationale for the explicit label:
 *   - Users were confused that stakes "succeeded" without holding any
 *     $RPO. It was actually the demo store — but the UI didn't say so.
 *   - Zero pretense: every write action is now labeled "(preview)"
 *     and every tx hash is prefixed `0xdemo…` (see lib/demoTx.ts).
 */
export function DemoModeBanner() {
  const [dismissed, setDismissed] = useState(false);

  // Persist dismissal across page loads so it's not annoying.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem("rpo-demo-banner-dismissed") === "1") {
      setDismissed(true);
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("rpo-demo-banner-dismissed", "1");
    }
  }

  if (dismissed) return null;

  return (
    <div className="bg-peach-50 border-b border-peach-200">
      <div className="px-5 lg:px-8 py-3 flex items-start gap-4 max-w-none">
        <span className="hidden sm:inline-flex mt-0.5 items-center justify-center h-6 w-6 rounded-full bg-peach-500 text-white text-[10px] font-bold shrink-0">
          !
        </span>
        <div className="flex-1 min-w-0 text-sm">
          <span className="font-semibold text-peach-600">
            Preview mode
          </span>
          <span className="text-ink-700">
            {" "}·{" "}
            Contracts are audited but not yet deployed to mainnet. Every
            balance, subscription, stake, and tx hash you see on{" "}
            <code className="font-mono text-xs">/app/*</code> is a{" "}
            <strong>local simulation</strong> stored in your browser —
            wallet connect is real, but nothing is written on-chain. Real
            $RPO + live contracts ship with mainnet (target Q4 2026).{" "}
            <a
              href="/roadmap"
              className="underline underline-offset-2 hover:text-ink-900"
            >
              Roadmap →
            </a>
          </span>
        </div>
        <button
          onClick={dismiss}
          className="mt-0.5 shrink-0 text-ink-500 hover:text-ink-900 transition-colors"
          aria-label="Dismiss preview-mode banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
