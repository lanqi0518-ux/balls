"use client";

/**
 * Top-of-app strip that surfaces the current chain the interface is
 * pointing at and — most importantly — whether the RPO protocol has
 * been deployed there yet. Replaces the old "preview mode" banner.
 *
 * There is no fake state, no local simulation. When the addresses in
 * `NEXT_PUBLIC_*_ADDRESS` are the zero address, every screen shows
 * "pending deployment" plus a testnet CTA. When they resolve to real
 * contracts, every screen wires itself up automatically.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { X } from "@/components/ui/Icons";
import { activeChain, PROTOCOL_LIVE } from "@/lib/chain";
import { useProtocol } from "@/lib/onchain/protocol";

export function NetworkStatus() {
  const proto = useProtocol();
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      window.sessionStorage.getItem("rpo-net-banner-dismissed") === "1" &&
      PROTOCOL_LIVE
    ) {
      setDismissed(true);
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    if (typeof window !== "undefined")
      window.sessionStorage.setItem("rpo-net-banner-dismissed", "1");
  }

  const wrongChain = isConnected && chainId !== proto.chainId;

  if (dismissed && proto.isLive && !wrongChain) return null;

  // ─── Pending deployment: no contracts wired up yet ─────────────────
  if (!proto.isLive) {
    return (
      <div className="bg-ink-900 text-white">
        <div className="px-5 lg:px-8 py-3 flex items-start gap-4">
          <span className="hidden sm:inline-flex mt-0.5 items-center justify-center h-6 w-6 rounded-full bg-peach-500 text-ink-900 text-[10px] font-bold shrink-0">
            ●
          </span>
          <div className="flex-1 min-w-0 text-sm leading-snug">
            <span className="font-semibold text-peach-500">
              Pre-launch
            </span>
            <span className="text-white/70">
              {" "}·{" "}
              The interface is wired to <strong>{proto.chainName}</strong>,
              but no RPO contracts have been deployed on that chain yet.
              Every write button will wait for a real deployment. Point the
              frontend at a testnet with a{" "}
              <Link
                href="/faucet"
                className="underline underline-offset-2 hover:text-white"
              >
                one-click faucet
              </Link>{" "}
              if you want to try the full flow now, or{" "}
              <Link
                href="/roadmap"
                className="underline underline-offset-2 hover:text-white"
              >
                watch the roadmap
              </Link>
              .
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Live but wallet is on the wrong chain ─────────────────────────
  if (wrongChain) {
    return (
      <div className="bg-peach-500 text-ink-900">
        <div className="px-5 lg:px-8 py-3 flex items-center gap-4">
          <span className="hidden sm:inline-flex h-6 w-6 rounded-full bg-ink-900 text-white items-center justify-center text-[10px] font-bold shrink-0">
            !
          </span>
          <div className="flex-1 text-sm">
            Wallet is on chain <span className="font-mono">{chainId}</span>.
            RPO is live on{" "}
            <span className="font-semibold">{proto.chainName}</span> (chain{" "}
            <span className="font-mono">{proto.chainId}</span>) — switch to
            interact.
          </div>
          <button
            className="btn-outline text-xs px-3 py-1.5"
            onClick={() => switchChain({ chainId: proto.chainId })}
            disabled={switching}
          >
            {switching ? "Switching…" : `Switch to ${proto.chainName}`}
          </button>
        </div>
      </div>
    );
  }

  // ─── Live: subtle testnet banner if applicable ─────────────────────
  if (proto.isTestnet) {
    return (
      <div className="bg-forest-50 border-b border-forest-200">
        <div className="px-5 lg:px-8 py-2 flex items-center gap-4 text-sm">
          <span className="h-2 w-2 rounded-full bg-forest-500 animate-pulse shrink-0" />
          <div className="flex-1 text-ink-900 leading-snug">
            <span className="font-semibold text-forest-500">
              Live on {proto.chainName}
            </span>
            <span className="text-ink-500">
              {" "}
              · Testnet build. Get free USDG + RPO from{" "}
              <Link href="/faucet" className="text-forest-500 underline">
                the faucet
              </Link>
              .
            </span>
          </div>
          <button
            onClick={dismiss}
            className="text-ink-500 hover:text-ink-900"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Mainnet + live: no banner
  return null;
}

/* ─────────────────────────────────────────────────────────────────
 * PendingDeploymentPanel — a full-card replacement for any /app
 * write surface when the protocol isn't live on the active chain.
 * Used by /app/stake and /app/ipo/[ticker] to avoid ever showing
 * fake write buttons.
 * ─────────────────────────────────────────────────────────────── */
export function PendingDeploymentPanel({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  const proto = useProtocol();
  return (
    <div className="card p-8 space-y-5">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-peach-500 animate-pulse" />
        <div className="eyebrow">Pending deployment</div>
      </div>
      <h3 className="text-2xl font-semibold text-ink-900">{title}</h3>
      <p className="text-sm text-ink-500 leading-relaxed">
        {hint ??
          `The interface is wired to ${proto.chainName} but the contracts have not been deployed there yet. Every button below will activate the moment addresses are configured — no rebuild, no code change.`}
      </p>
      <div className="rounded-xl border border-line bg-paper-100 p-4 text-xs text-ink-500 font-mono leading-relaxed">
        <div className="text-ink-900 font-semibold text-[11px] uppercase tracking-[0.14em] mb-2 font-sans">
          Missing addresses ({proto.missing.length})
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {proto.missing.length === 0
            ? "all present"
            : proto.missing.map((k) => (
                <span key={k} className="text-peach-600">
                  NEXT_PUBLIC_{k.toUpperCase()}_ADDRESS
                </span>
              ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/faucet"
          className="btn-primary text-sm px-4 py-2"
        >
          Try on testnet
        </Link>
        <Link href="/roadmap" className="btn-outline text-sm px-4 py-2">
          Roadmap →
        </Link>
        <span className="text-xs text-ink-500 ml-auto">
          Chain <span className="font-mono">{proto.chainName}</span> ·{" "}
          <span className="font-mono">{proto.chainId}</span>
        </span>
      </div>
    </div>
  );
}
