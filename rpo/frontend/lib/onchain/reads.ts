"use client";

/**
 * Real onchain read hooks. Every one returns a fully typed BigInt and
 * safely returns `0n` when the underlying contract is not yet
 * deployed on the active chain — so screens can call them
 * unconditionally and simply show `0` instead of lying.
 *
 * All hooks gate `enabled` on wallet-connected AND contract-deployed,
 * so RPCs never fire against the zero address.
 */

import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import {
  AllocationBoosterABI,
  ERC20_ABI,
  FaucetABI,
  IPORegistryABI,
  SubscriptionVaultABI,
} from "@/lib/abi";
import { CONTRACTS, activeChain, isDeployed } from "@/lib/chain";

type ReadResult<T> = {
  data: T;
  isLoading: boolean;
  isFetched: boolean;
  refetch: () => void;
};

const ZERO_BI: bigint = 0n;

/** USDG wallet balance. Returns 0n when address / wallet unavailable. */
export function useUsdgBalance(): ReadResult<bigint> {
  const { address } = useAccount();
  const q = useReadContract({
    address: CONTRACTS.usdg,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: activeChain.id,
    query: {
      enabled: !!address && isDeployed(CONTRACTS.usdg),
      staleTime: 15_000,
    },
  });
  return {
    data: (q.data as bigint | undefined) ?? ZERO_BI,
    isLoading: q.isLoading,
    isFetched: q.isFetched,
    refetch: q.refetch,
  };
}

/** $RPO wallet balance. */
export function useRpoBalance(): ReadResult<bigint> {
  const { address } = useAccount();
  const q = useReadContract({
    address: CONTRACTS.rpo,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: activeChain.id,
    query: {
      enabled: !!address && isDeployed(CONTRACTS.rpo),
      staleTime: 15_000,
    },
  });
  return {
    data: (q.data as bigint | undefined) ?? ZERO_BI,
    isLoading: q.isLoading,
    isFetched: q.isFetched,
    refetch: q.refetch,
  };
}

/** ERC-20 allowance from connected wallet → spender. */
export function useAllowance(
  token: `0x${string}`,
  spender: `0x${string}` | undefined
): ReadResult<bigint> {
  const { address } = useAccount();
  const q = useReadContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && spender ? [address, spender] : undefined,
    chainId: activeChain.id,
    query: {
      enabled:
        !!address &&
        !!spender &&
        isDeployed(token) &&
        isDeployed(spender ?? "0x0000000000000000000000000000000000000000"),
      staleTime: 10_000,
    },
  });
  return {
    data: (q.data as bigint | undefined) ?? ZERO_BI,
    isLoading: q.isLoading,
    isFetched: q.isFetched,
    refetch: q.refetch,
  };
}

/** Booster: staked amount and unlockAt for the connected wallet. */
export function useStake(): ReadResult<{
  amount: bigint;
  unlockAt: bigint;
}> {
  const { address } = useAccount();
  const q = useReadContract({
    address: CONTRACTS.booster,
    abi: AllocationBoosterABI,
    functionName: "stakes",
    args: address ? [address] : undefined,
    chainId: activeChain.id,
    query: {
      enabled: !!address && isDeployed(CONTRACTS.booster),
      staleTime: 15_000,
    },
  });
  const [amount, unlockAt] =
    (q.data as [bigint, bigint] | undefined) ?? [ZERO_BI, ZERO_BI];
  return {
    data: { amount, unlockAt },
    isLoading: q.isLoading,
    isFetched: q.isFetched,
    refetch: q.refetch,
  };
}

/** Booster: getBoost(user) returns 1e18 fixed-point (1e18 = 1×, 3e18 = 3×). */
export function useBoost(): ReadResult<bigint> {
  const { address } = useAccount();
  const q = useReadContract({
    address: CONTRACTS.booster,
    abi: AllocationBoosterABI,
    functionName: "getBoost",
    args: address ? [address] : undefined,
    chainId: activeChain.id,
    query: {
      enabled: !!address && isDeployed(CONTRACTS.booster),
      staleTime: 15_000,
    },
  });
  return {
    data: (q.data as bigint | undefined) ?? 10n ** 18n,
    isLoading: q.isLoading,
    isFetched: q.isFetched,
    refetch: q.refetch,
  };
}

/** Booster: totalStaked() across all wallets. */
export function useTotalStaked(): ReadResult<bigint> {
  const q = useReadContract({
    address: CONTRACTS.booster,
    abi: AllocationBoosterABI,
    functionName: "totalStaked",
    chainId: activeChain.id,
    query: {
      enabled: isDeployed(CONTRACTS.booster),
      staleTime: 30_000,
    },
  });
  return {
    data: (q.data as bigint | undefined) ?? ZERO_BI,
    isLoading: q.isLoading,
    isFetched: q.isFetched,
    refetch: q.refetch,
  };
}

/** Faucet: seconds until the wallet is eligible for another drip. */
export function useFaucetCountdown(): ReadResult<bigint> {
  const { address } = useAccount();
  const q = useReadContract({
    address: CONTRACTS.faucet,
    abi: FaucetABI,
    functionName: "timeToNextDrip",
    args: address ? [address] : undefined,
    chainId: activeChain.id,
    query: {
      enabled: !!address && isDeployed(CONTRACTS.faucet),
      staleTime: 5_000,
    },
  });
  return {
    data: (q.data as bigint | undefined) ?? ZERO_BI,
    isLoading: q.isLoading,
    isFetched: q.isFetched,
    refetch: q.refetch,
  };
}

/** IPORegistry: full active IPO array. Real deal flow. */
export type OnchainIPO = {
  ticker: string;
  name: string;
  stockToken: `0x${string}`;
  vault: `0x${string}`;
  subscriptionDeadline: bigint;
  fulfillmentDeadline: bigint;
  status: number;
};

export function useActiveIPOs(): ReadResult<OnchainIPO[]> {
  const q = useReadContract({
    address: CONTRACTS.registry,
    abi: IPORegistryABI,
    functionName: "getActiveIPOs",
    chainId: activeChain.id,
    query: {
      enabled: isDeployed(CONTRACTS.registry),
      staleTime: 20_000,
    },
  });
  const data = useMemo<OnchainIPO[]>(() => {
    return (q.data as OnchainIPO[] | undefined) ?? [];
  }, [q.data]);
  return {
    data,
    isLoading: q.isLoading,
    isFetched: q.isFetched,
    refetch: q.refetch,
  };
}

/** Per-vault deposit + weight + claimed flag for the connected wallet. */
export function useVaultPosition(vault: `0x${string}` | undefined) {
  const { address } = useAccount();
  const enabled = !!address && !!vault && isDeployed(vault);
  const q = useReadContracts({
    contracts: enabled
      ? [
          {
            address: vault!,
            abi: SubscriptionVaultABI,
            functionName: "deposits",
            args: [address!],
            chainId: activeChain.id,
          },
          {
            address: vault!,
            abi: SubscriptionVaultABI,
            functionName: "weights",
            args: [address!],
            chainId: activeChain.id,
          },
          {
            address: vault!,
            abi: SubscriptionVaultABI,
            functionName: "claimed",
            args: [address!],
            chainId: activeChain.id,
          },
          {
            address: vault!,
            abi: SubscriptionVaultABI,
            functionName: "totalUSDG",
            chainId: activeChain.id,
          },
          {
            address: vault!,
            abi: SubscriptionVaultABI,
            functionName: "fulfilled",
            chainId: activeChain.id,
          },
        ]
      : [],
    query: { enabled, staleTime: 15_000 },
  });

  const [deposits, weights, claimed, totalUSDG, fulfilled] =
    q.data ?? [];
  return {
    data: {
      deposits: (deposits?.result as bigint | undefined) ?? ZERO_BI,
      weights: (weights?.result as bigint | undefined) ?? ZERO_BI,
      claimed: (claimed?.result as boolean | undefined) ?? false,
      totalUSDG: (totalUSDG?.result as bigint | undefined) ?? ZERO_BI,
      fulfilled: (fulfilled?.result as boolean | undefined) ?? false,
    },
    isLoading: q.isLoading,
    isFetched: q.isFetched,
    refetch: q.refetch,
  };
}
