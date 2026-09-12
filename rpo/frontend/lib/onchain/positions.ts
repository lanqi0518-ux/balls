"use client";

/**
 * Aggregate onchain positions: for every active IPO the wallet has
 * subscribed to, read (deposits, weights, claimed, fulfilled) from
 * the vault. Consumed by /app/positions.
 */

import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { SubscriptionVaultABI } from "@/lib/abi";
import { activeChain, isDeployed } from "@/lib/chain";
import { OnchainIPO, useActiveIPOs } from "./reads";

export type OnchainPosition = {
  ipo: OnchainIPO;
  deposits: bigint;
  weight: bigint;
  claimed: boolean;
  fulfilled: boolean;
};

export function useOnchainPositions(): {
  data: OnchainPosition[];
  isLoading: boolean;
  refetch: () => void;
} {
  const { address } = useAccount();
  const active = useActiveIPOs();

  const vaults = active.data.filter((v) => isDeployed(v.vault));

  const contracts = vaults.flatMap((v) =>
    address
      ? [
          {
            address: v.vault,
            abi: SubscriptionVaultABI,
            functionName: "deposits" as const,
            args: [address] as const,
            chainId: activeChain.id,
          },
          {
            address: v.vault,
            abi: SubscriptionVaultABI,
            functionName: "weights" as const,
            args: [address] as const,
            chainId: activeChain.id,
          },
          {
            address: v.vault,
            abi: SubscriptionVaultABI,
            functionName: "claimed" as const,
            args: [address] as const,
            chainId: activeChain.id,
          },
          {
            address: v.vault,
            abi: SubscriptionVaultABI,
            functionName: "fulfilled" as const,
            chainId: activeChain.id,
          },
        ]
      : []
  );

  const q = useReadContracts({
    contracts: contracts as any,
    query: {
      enabled: !!address && contracts.length > 0,
      staleTime: 20_000,
    },
  });

  const data = useMemo<OnchainPosition[]>(() => {
    if (!address || !q.data) return [];
    const out: OnchainPosition[] = [];
    for (let i = 0; i < vaults.length; i++) {
      const base = i * 4;
      const deposits = (q.data[base]?.result as bigint | undefined) ?? 0n;
      const weight = (q.data[base + 1]?.result as bigint | undefined) ?? 0n;
      const claimed =
        (q.data[base + 2]?.result as boolean | undefined) ?? false;
      const fulfilled =
        (q.data[base + 3]?.result as boolean | undefined) ?? false;
      if (deposits > 0n || (fulfilled && !claimed)) {
        out.push({ ipo: vaults[i], deposits, weight, claimed, fulfilled });
      }
    }
    return out;
  }, [address, q.data, vaults]);

  return {
    data,
    isLoading: active.isLoading || q.isLoading,
    refetch: () => {
      active.refetch();
      q.refetch();
    },
  };
}
