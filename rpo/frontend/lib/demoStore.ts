"use client";

/**
 * Client-only zustand store. Local demo state that persists to
 * localStorage — separate from the pure catalog in lib/catalog.ts so
 * marketing pages can render the catalog on the server without pulling
 * in this client module.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Re-export catalog symbols so consumers don't have to know which file
// to import from (backward-compat with earlier scaffold).
export {
  IPO_SEEDS,
  ALL_ACTIVE,
  ALL_LIVE,
  ALL_FULFILLED,
  BY_SOURCE,
  LIVE_BY_SOURCE,
  TOTAL_LIVE,
  TOTAL_VAULTS,
  ACTIVITY_FEED,
  PIPELINE,
  findIPO,
} from "./catalog";

export type {
  Source,
  Status,
  IPOSeed,
  ActivityEvent,
  PipelineItem,
} from "./catalog";

export type Subscription = {
  id: string;
  ticker: string;
  amountUSDG: number;
  weight: number;
  createdAtMs: number;
};

export type Holding = {
  ticker: string;
  amount: number;
  entryPrice: number;
};

export type TxEntry = {
  id: string;
  ts: number;
  kind: "Subscribe" | "Cancel" | "Claim" | "Stake" | "Unstake";
  ticker?: string;
  amount: string;
  hash: string;
};

type State = {
  balanceUSDG: number;
  balanceRPO: number;
  stakedRPO: number;
  subscriptions: Subscription[];
  holdings: Holding[];
  history: TxEntry[];
  totalStakedPool: number;

  subscribe: (ticker: string, amountUSDG: number, boost: number) => void;
  cancel: (id: string) => void;
  claim: (ticker: string, amountTokens: number, priceAtClaim: number) => void;
  stake: (amount: number) => void;
  unstake: (amount: number) => void;
  reset: () => void;
};

const initial: Pick<
  State,
  | "balanceUSDG"
  | "balanceRPO"
  | "stakedRPO"
  | "subscriptions"
  | "holdings"
  | "history"
  | "totalStakedPool"
> = {
  balanceUSDG: 10_000,
  balanceRPO: 50_000,
  stakedRPO: 20_000,
  subscriptions: [],
  holdings: [
    { ticker: "dCORZ", amount: 120.5, entryPrice: 17.05 },
    { ticker: "dRDDT", amount: 34.2, entryPrice: 26.7 },
  ],
  history: [],
  totalStakedPool: 1_700_000,
};

function fakeHash(): string {
  // Prefix with "demo" so the user can never mistake this for a real
  // on-chain tx hash. Every /app write action uses this same function.
  const chars = "0123456789abcdef";
  let rest = "";
  for (let i = 0; i < 60; i++) rest += chars[Math.floor(Math.random() * 16)];
  return "0xdemo" + rest;
}

export const useDemoStore = create<State>()(
  persist(
    (set) => ({
      ...initial,

      subscribe: (ticker, amount, boost) =>
        set((s) => {
          if (amount > s.balanceUSDG) return s;
          const sub: Subscription = {
            id: `${ticker}-${Date.now()}`,
            ticker,
            amountUSDG: amount,
            weight: amount * boost,
            createdAtMs: Date.now(),
          };
          const tx: TxEntry = {
            id: sub.id,
            ts: Date.now(),
            kind: "Subscribe",
            ticker,
            amount: `$${amount.toLocaleString()}`,
            hash: fakeHash(),
          };
          return {
            balanceUSDG: s.balanceUSDG - amount,
            subscriptions: [sub, ...s.subscriptions],
            history: [tx, ...s.history],
          };
        }),

      cancel: (id) =>
        set((s) => {
          const sub = s.subscriptions.find((x) => x.id === id);
          if (!sub) return s;
          const tx: TxEntry = {
            id: fakeHash().slice(0, 10),
            ts: Date.now(),
            kind: "Cancel",
            ticker: sub.ticker,
            amount: `$${sub.amountUSDG.toLocaleString()}`,
            hash: fakeHash(),
          };
          return {
            balanceUSDG: s.balanceUSDG + sub.amountUSDG,
            subscriptions: s.subscriptions.filter((x) => x.id !== id),
            history: [tx, ...s.history],
          };
        }),

      claim: (ticker, amountTokens, priceAtClaim) =>
        set((s) => {
          const existing = s.holdings.find((h) => h.ticker === `d${ticker}`);
          const newHoldings = existing
            ? s.holdings.map((h) =>
                h.ticker === `d${ticker}`
                  ? {
                      ...h,
                      amount: h.amount + amountTokens,
                      entryPrice:
                        (h.entryPrice * h.amount +
                          priceAtClaim * amountTokens) /
                        (h.amount + amountTokens),
                    }
                  : h
              )
            : [
                ...s.holdings,
                {
                  ticker: `d${ticker}`,
                  amount: amountTokens,
                  entryPrice: priceAtClaim,
                },
              ];
          const tx: TxEntry = {
            id: fakeHash().slice(0, 10),
            ts: Date.now(),
            kind: "Claim",
            ticker,
            amount: `${amountTokens.toFixed(4)} d${ticker}`,
            hash: fakeHash(),
          };
          return { holdings: newHoldings, history: [tx, ...s.history] };
        }),

      stake: (amount) =>
        set((s) => {
          if (amount > s.balanceRPO) return s;
          const tx: TxEntry = {
            id: fakeHash().slice(0, 10),
            ts: Date.now(),
            kind: "Stake",
            amount: `${amount.toLocaleString()} $RPO`,
            hash: fakeHash(),
          };
          return {
            balanceRPO: s.balanceRPO - amount,
            stakedRPO: s.stakedRPO + amount,
            totalStakedPool: s.totalStakedPool + amount,
            history: [tx, ...s.history],
          };
        }),

      unstake: (amount) =>
        set((s) => {
          if (amount > s.stakedRPO) return s;
          const tx: TxEntry = {
            id: fakeHash().slice(0, 10),
            ts: Date.now(),
            kind: "Unstake",
            amount: `${amount.toLocaleString()} $RPO`,
            hash: fakeHash(),
          };
          return {
            balanceRPO: s.balanceRPO + amount,
            stakedRPO: s.stakedRPO - amount,
            totalStakedPool: Math.max(0, s.totalStakedPool - amount),
            history: [tx, ...s.history],
          };
        }),

      reset: () => set(() => ({ ...initial })),
    }),
    { name: "rpo-demo-v1" }
  )
);

/** Boost curve: 1 + 2·√share, capped at 3× (mirrors AllocationBooster.sol) */
export function computeBoost(stakedRPO: number, totalPool: number): number {
  if (stakedRPO <= 0 || totalPool <= 0) return 1;
  const share = stakedRPO / totalPool;
  const b = 1 + 2 * Math.sqrt(share);
  return Math.min(3, b);
}
