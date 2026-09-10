"use client";

/**
 * Small helpers to bridge between BigInt units and human numbers.
 * Callers should always pass explicit decimals so we never confuse
 * USDG (6 decimals) with RPO (18 decimals).
 */

import { formatUnits, parseUnits } from "viem";

export const RPO_DECIMALS = 18;
export const USDG_DECIMALS = 6;
export const BOOST_SCALE = 10n ** 18n; // 1× in booster fixed-point (1e18)

/** BigInt → Number (safe for display; loses precision above 2^53). */
export function toNumber(x: bigint, decimals: number): number {
  return Number(formatUnits(x, decimals));
}

/** String → BigInt, clamped to non-negative. */
export function toUnits(x: string | number, decimals: number): bigint {
  const s = typeof x === "number" ? x.toString() : x;
  const clean = s.replace(/[^0-9.]/g, "");
  if (!clean) return 0n;
  try {
    return parseUnits(clean as `${number}`, decimals);
  } catch {
    return 0n;
  }
}

/** Convert booster 1e18 fixed-point (1e18 = 1×, 3e18 = 3×) → JS number. */
export function boostToNumber(fp: bigint): number {
  return Number(formatUnits(fp, 18));
}
