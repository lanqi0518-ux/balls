"use client";

/**
 * Zustand-backed local demo store.
 *
 * In production this would be replaced by real reads from IPORegistry +
 * SubscriptionVault + AllocationBooster contracts. In demo mode we persist
 * user activity to localStorage so every action (subscribe, cancel, claim,
 * stake) has a real end-to-end effect on the visible UI.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type IPOSeed = {
  ticker: string;
  name: string;
  status: "Subscribing" | "Announced" | "Fulfilled" | "Refunded";
  targetUSD: number;
  seedSubscribedUSD: number; // aggregate community subscribed (not incl. user)
  expectedPrice: number;
  launchAtMs: number;
  fillPrice?: number; // set when status === "Fulfilled"
  change24hPct?: number;
};

export type Subscription = {
  id: string; // ticker + ts
  ticker: string;
  amountUSDG: number;
  weight: number; // amount * boost, at time of subscription
  createdAtMs: number;
};

export type Holding = {
  ticker: string; // "dCORZ"
  amount: number; // token count
  entryPrice: number;
};

export type TxEntry = {
  id: string;
  ts: number;
  kind: "Subscribe" | "Cancel" | "Claim" | "Stake" | "Unstake";
  ticker?: string;
  amount: string; // "$500" or "5.88 dCORZ"
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

  // Actions
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
  const chars = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < 64; i++) out += chars[Math.floor(Math.random() * 16)];
  return out;
}

export const useDemoStore = create<State>()(
  persist(
    (set, get) => ({
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

/**
 * Boost curve: 1 + 2·√share, capped at 3×.
 * Kept in sync with AllocationBooster.sol.
 */
export function computeBoost(stakedRPO: number, totalPool: number): number {
  if (stakedRPO <= 0 || totalPool <= 0) return 1;
  const share = stakedRPO / totalPool;
  const b = 1 + 2 * Math.sqrt(share);
  return Math.min(3, b);
}

/** IPO seed data — in production, replaced by IPORegistry.getActiveIPOs() */
export const IPO_SEEDS: IPOSeed[] = [
  {
    ticker: "STRIPE",
    name: "Stripe, Inc.",
    status: "Subscribing",
    targetUSD: 5_000_000,
    seedSubscribedUSD: 2_300_000,
    expectedPrice: 85.2,
    launchAtMs: Date.now() + 3 * 86_400_000 + 4 * 3_600_000,
  },
  {
    ticker: "KLARNA",
    name: "Klarna Bank AB",
    status: "Subscribing",
    targetUSD: 3_000_000,
    seedSubscribedUSD: 450_000,
    expectedPrice: 32,
    launchAtMs: Date.now() + 8 * 86_400_000,
  },
  {
    ticker: "REDDIT",
    name: "Reddit, Inc.",
    status: "Announced",
    targetUSD: 4_000_000,
    seedSubscribedUSD: 1_100_000,
    expectedPrice: 47,
    launchAtMs: Date.now() + 12 * 86_400_000,
  },
  {
    ticker: "CORZ",
    name: "Core Scientific",
    status: "Fulfilled",
    targetUSD: 5_000_000,
    seedSubscribedUSD: 4_900_000,
    expectedPrice: 17.05,
    fillPrice: 17.05,
    change24hPct: 18.2,
    launchAtMs: Date.now() - 24 * 86_400_000,
  },
  {
    ticker: "TSMC-2",
    name: "TSMC Series 2",
    status: "Fulfilled",
    targetUSD: 3_000_000,
    seedSubscribedUSD: 3_100_000,
    expectedPrice: 212.15,
    fillPrice: 212.15,
    change24hPct: 6.4,
    launchAtMs: Date.now() - 12 * 86_400_000,
  },
  {
    ticker: "NVDA-B",
    name: "NVIDIA Class B",
    status: "Fulfilled",
    targetUSD: 3_000_000,
    seedSubscribedUSD: 2_600_000,
    expectedPrice: 102.02,
    fillPrice: 102.02,
    change24hPct: -1.1,
    launchAtMs: Date.now() - 4 * 86_400_000,
  },
];

/**
 * Deal-flow pipeline: what the keeper + curation team have queued but
 * hasn't yet opened for subscription. Kept visible on the app calendar
 * so users can confirm continuous deal flow, not just what's currently
 * live. In production, populated from IPORegistry.getPipeline() and the
 * off-chain curation feed.
 */
export type PipelineItem = {
  ticker: string;
  name: string;
  source:
    | "RHJ Reg-S"
    | "Aftermarket Vault"
    | "Direct Reg-S"
    | "Reg-A+"
    | "Grants";
  etaDays: number;
  targetUSD: number;
  note?: string;
};

export const PIPELINE: PipelineItem[] = [
  {
    ticker: "DBX",
    name: "Databricks, Inc.",
    source: "RHJ Reg-S",
    etaDays: 14,
    targetUSD: 6_000_000,
    note: "Detected on /rhj/assets · propose() eligible",
  },
  {
    ticker: "OAI",
    name: "OpenAI (secondary)",
    source: "Direct Reg-S",
    etaDays: 21,
    targetUSD: 10_000_000,
    note: "Cayman SPV in escrow · legal review passed",
  },
  {
    ticker: "SPY",
    name: "SPDR S&P 500 (aftermarket)",
    source: "Aftermarket Vault",
    etaDays: 0,
    targetUSD: 2_000_000,
    note: "Always-on · batch-fulfills every 4h",
  },
  {
    ticker: "TSLA",
    name: "Tesla Inc. (aftermarket)",
    source: "Aftermarket Vault",
    etaDays: 0,
    targetUSD: 2_000_000,
    note: "Always-on · Chainlink-bound",
  },
  {
    ticker: "SHEIN",
    name: "Roadget Business (SHEIN)",
    source: "RHJ Reg-S",
    etaDays: 42,
    targetUSD: 8_000_000,
    note: "Filing rumored · monitoring /rhj/assets",
  },
  {
    ticker: "PLTR-2",
    name: "Palantir Class B",
    source: "RHJ Reg-S",
    etaDays: 30,
    targetUSD: 4_000_000,
    note: "Waiting on RHJ confirmation",
  },
  {
    ticker: "NEURA",
    name: "Neura Robotics (Grants)",
    source: "Grants",
    etaDays: 55,
    targetUSD: 3_000_000,
    note: "$120k legal underwriting approved",
  },
  {
    ticker: "MSTR",
    name: "MicroStrategy (aftermarket)",
    source: "Aftermarket Vault",
    etaDays: 0,
    targetUSD: 1_500_000,
    note: "Always-on",
  },
  {
    ticker: "PLURAL",
    name: "Plural Energy (Reg-A+ pilot)",
    source: "Reg-A+",
    etaDays: 180,
    targetUSD: 25_000_000,
    note: "SEC qualification in progress · Q2 2027",
  },
];

export function findIPO(ticker: string): IPOSeed | undefined {
  return IPO_SEEDS.find(
    (s) => s.ticker.toLowerCase() === ticker.toLowerCase()
  );
}
