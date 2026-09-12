/**
 * Pure deal-flow catalog — no client-only code, so it's safe to import
 * from Server Components.
 *
 * PRE-LAUNCH POLICY: while the protocol has not been deployed
 * (`PROTOCOL_LIVE === false`) this module returns EMPTY arrays for every
 * public export. Nothing fake is displayed on the marketing site or in
 * the /app calendar — the runtime UI is expected to render its
 * pre-launch empty states from these zero values.
 *
 * Once contracts are deployed and the appropriate `NEXT_PUBLIC_*_ADDRESS`
 * env vars are set, the runtime `/app` UX pulls the authoritative live
 * list from `IPORegistry.getAll()` / `AssetDiscovery.pipeline()` via
 * `lib/onchain/reads.ts`. This file becomes vestigial at that point.
 */

import { PROTOCOL_LIVE } from "./chain";

export type Source =
  | "RHJ Reg-S"
  | "Aftermarket"
  | "Pons Launchpad"
  | "Direct Reg-S"
  | "Reg-A+";

export type Status = "Subscribing" | "Announced" | "Fulfilled" | "Refunded";

export type IPOSeed = {
  ticker: string;
  name: string;
  source: Source;
  status: Status;
  targetUSD: number;
  seedSubscribedUSD: number;
  expectedPrice: number;
  launchAtMs: number;
  launchOffsetSec: number;
  fillPrice?: number;
  change24hPct?: number;
  note?: string;
  alwaysOn?: boolean;
};

export type ActivityEvent = {
  ticker: string;
  amountUSDG: number;
  wallet: string;
  boost: number;
  agoSec: number;
};

export type PipelineItem = {
  ticker: string;
  name: string;
  source: Source | "Grants";
  etaDays: number;
  targetUSD: number;
  note?: string;
};

/**
 * All arrays are empty pre-launch. When the protocol goes live, the
 * runtime UX reads real state from on-chain (see `lib/onchain/reads.ts`);
 * these placeholders stay empty and become unused.
 */
export const IPO_SEEDS: IPOSeed[] = PROTOCOL_LIVE ? [] : [];
export const ALL_ACTIVE: IPOSeed[] = [];
export const ALL_LIVE: IPOSeed[] = [];
export const ALL_FULFILLED: IPOSeed[] = [];

export const BY_SOURCE = (_src: Source | "All"): IPOSeed[] => [];

export const LIVE_BY_SOURCE: Record<Source, number> = {
  "RHJ Reg-S": 0,
  "Aftermarket": 0,
  "Pons Launchpad": 0,
  "Direct Reg-S": 0,
  "Reg-A+": 0,
};

export const TOTAL_LIVE = 0;
export const TOTAL_VAULTS = 0;

export const ACTIVITY_FEED: ActivityEvent[] = [];

export const PIPELINE: PipelineItem[] = [];

export function findIPO(_ticker: string): IPOSeed | undefined {
  return undefined;
}
