"use client";

/**
 * Live event feed. Subscribes to onchain Subscribed / Staked / Unstaked
 * / Claimed events from the deployed contracts and shows the most
 * recent ones. When no contracts are deployed on the active chain, or
 * no wallet is connected, the drawer is empty (never fake).
 */

import { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { getContract } from "viem";
import {
  AllocationBoosterABI,
  SubscriptionVaultABI,
} from "@/lib/abi";
import {
  CONTRACTS,
  activeChain,
  explorerTx,
  isDeployed,
} from "@/lib/chain";
import { useActiveIPOs } from "@/lib/onchain/reads";
import { Bell, X } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";

type Entry = {
  id: string;
  ts: number;
  kind: "Subscribed" | "Staked" | "Unstaked" | "Claimed";
  ticker?: string;
  amount: string;
  hash: string;
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: activeChain.id });
  const active = useActiveIPOs();
  const [entries, setEntries] = useState<Entry[]>([]);

  // Watch booster stake / unstake for the connected wallet
  useEffect(() => {
    if (!publicClient || !address || !isDeployed(CONTRACTS.booster))
      return;
    const unsub1 = publicClient.watchContractEvent({
      address: CONTRACTS.booster,
      abi: AllocationBoosterABI,
      eventName: "Staked",
      args: { user: address },
      onLogs: (logs) => addFromLogs(logs, "Staked", setEntries),
    });
    const unsub2 = publicClient.watchContractEvent({
      address: CONTRACTS.booster,
      abi: AllocationBoosterABI,
      eventName: "Unstaked",
      args: { user: address },
      onLogs: (logs) => addFromLogs(logs, "Unstaked", setEntries),
    });
    return () => {
      unsub1?.();
      unsub2?.();
    };
  }, [address, publicClient]);

  // Watch every active vault for Subscribed / Claimed
  useEffect(() => {
    if (!publicClient || !address) return;
    const unsubs = active.data
      .filter((v) => isDeployed(v.vault))
      .flatMap((v) => [
        publicClient.watchContractEvent({
          address: v.vault,
          abi: SubscriptionVaultABI,
          eventName: "Subscribed",
          args: { user: address },
          onLogs: (logs) =>
            addFromLogs(logs, "Subscribed", setEntries, v.ticker),
        }),
        publicClient.watchContractEvent({
          address: v.vault,
          abi: SubscriptionVaultABI,
          eventName: "Claimed",
          args: { user: address },
          onLogs: (logs) =>
            addFromLogs(logs, "Claimed", setEntries, v.ticker),
        }),
      ]);
    return () => {
      unsubs.forEach((u) => u?.());
    };
  }, [active.data, address, publicClient]);

  const unread = entries.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative h-9 w-9 rounded-full border border-line bg-white hover:bg-paper-100 flex items-center justify-center transition-colors"
        aria-label="Open notifications"
      >
        <Bell className="h-4 w-4 text-ink-500" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-peach-500 text-white text-[10px] font-mono flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-ink-900/20 backdrop-blur-sm z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white z-50 shadow-floating",
              "border-l border-line flex flex-col"
            )}
          >
            <div className="h-16 flex items-center justify-between border-b border-line px-6 flex-shrink-0">
              <div>
                <div className="font-semibold text-ink-900">Notifications</div>
                <div className="text-xs text-ink-500">
                  {entries.length} event{entries.length === 1 ? "" : "s"}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-paper-100 flex items-center justify-center"
              >
                <X className="h-4 w-4 text-ink-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {entries.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-paper-100 border border-line flex items-center justify-center mx-auto mb-4">
                    <Bell className="h-5 w-5 text-ink-500" />
                  </div>
                  <div className="text-ink-900 font-medium mb-1">
                    Nothing yet.
                  </div>
                  <div className="text-sm text-ink-500">
                    Onchain events for your wallet will land here in
                    real time.
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {entries.slice(0, 40).map((h) => (
                    <li
                      key={h.id + h.hash}
                      className="p-5 hover:bg-paper-100 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full mt-2 flex-shrink-0",
                            h.kind === "Subscribed"
                              ? "bg-forest-500"
                              : h.kind === "Claimed"
                              ? "bg-peach-500"
                              : "bg-ink-500"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-ink-900 font-medium text-sm">
                              {h.kind}
                            </span>
                            {h.ticker && (
                              <span className="text-xs text-ink-500 font-mono">
                                {h.ticker}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-ink-500 mt-1">
                            {h.amount}
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-ink-500 font-mono">
                            <span>{relative(h.ts)}</span>
                            <span className="text-ink-300">·</span>
                            <a
                              href={explorerTx(h.hash)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-forest-500 hover:underline"
                            >
                              {h.hash.slice(0, 10)}…
                            </a>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-line p-4 flex-shrink-0">
              <button
                onClick={() => setEntries([])}
                className="text-xs text-ink-500 hover:text-ink-900"
              >
                Clear list
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function addFromLogs(
  logs: any[],
  kind: Entry["kind"],
  setEntries: React.Dispatch<React.SetStateAction<Entry[]>>,
  ticker?: string
) {
  if (!logs || logs.length === 0) return;
  setEntries((prev) => {
    const next = [...prev];
    for (const log of logs) {
      const amount = log.args?.amount?.toString?.() ?? "";
      next.unshift({
        id: `${log.transactionHash}-${log.logIndex}`,
        ts: Date.now(),
        kind,
        ticker,
        amount: amount ? `${amount}` : "",
        hash: log.transactionHash ?? "",
      });
    }
    return next.slice(0, 200);
  });
}

function relative(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(ts).toISOString().slice(0, 10);
}
