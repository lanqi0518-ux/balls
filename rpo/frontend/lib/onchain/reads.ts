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
import {
  EXTSLOAD_CALLDATA,
  PERMIT2_ABI,
  PERMIT2_ADDRESS,
  POOL_MANAGER_ABI,
  V4_POOL_MANAGER,
  V4_POOLS,
  V4_UNIVERSAL_ROUTER,
  decodeSlot0,
  midPriceUsdgPerStock,
  slotForPoolSlot0,
} from "@/lib/robinhood/v4";

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

/**
 * Uniswap V4 pool mid-price for one of the configured stock tokens.
 * Reads `slot0` via PoolManager.extsload — one RPC call — and derives
 * a USDG-per-stock mid.
 *
 * The mid is not the final fill price; the buy widget will still
 * calculate an amount-out estimate + slippage floor at click time.
 */
export function useV4PoolMid(ticker: string): ReadResult<{
  sqrtPriceX96: bigint;
  tick: number;
  lpFee: number;
  usdgPerStock: number;
}> {
  const pool = V4_POOLS[ticker.toUpperCase()];
  const enabled = !!pool;
  const q = useReadContract({
    address: V4_POOL_MANAGER,
    abi: POOL_MANAGER_ABI,
    functionName: "extsload",
    args: pool ? [slotForPoolSlot0(pool.poolId)] : undefined,
    chainId: activeChain.id,
    query: {
      enabled,
      staleTime: 15_000,
      refetchInterval: 30_000,
    },
  });
  const data = useMemo(() => {
    if (!pool || q.data == null) {
      return {
        sqrtPriceX96: 0n,
        tick: 0,
        lpFee: 0,
        usdgPerStock: 0,
      };
    }
    const raw = BigInt(q.data as `0x${string}`);
    const decoded = decodeSlot0(raw);
    return {
      sqrtPriceX96: decoded.sqrtPriceX96,
      tick: decoded.tick,
      lpFee: decoded.lpFee,
      usdgPerStock: midPriceUsdgPerStock(
        decoded.sqrtPriceX96,
        pool.usdgIsCurrency0
      ),
    };
  }, [pool, q.data]);
  return {
    data,
    isLoading: q.isLoading,
    isFetched: q.isFetched,
    refetch: q.refetch,
  };
}

/**
 * Permit2 allowance for connected wallet → UniversalRouter, for a
 * specific token. Returns `{ amount, expiration, nonce }` as bigints.
 */
export function usePermit2Allowance(
  token: `0x${string}`,
  spender: `0x${string}` = V4_UNIVERSAL_ROUTER
): ReadResult<{ amount: bigint; expiration: bigint; nonce: bigint }> {
  const { address } = useAccount();
  const q = useReadContract({
    address: PERMIT2_ADDRESS,
    abi: PERMIT2_ABI,
    functionName: "allowance",
    args: address ? [address, token, spender] : undefined,
    chainId: activeChain.id,
    query: {
      enabled: !!address && isDeployed(token),
      staleTime: 15_000,
    },
  });
  const data = useMemo(() => {
    const raw = q.data as [bigint, bigint, bigint] | undefined;
    return {
      amount: raw?.[0] ?? 0n,
      expiration: raw?.[1] ?? 0n,
      nonce: raw?.[2] ?? 0n,
    };
  }, [q.data]);
  return {
    data,
    isLoading: q.isLoading,
    isFetched: q.isFetched,
    refetch: q.refetch,
  };
}

/**
 * ERC-20 balance for the connected wallet, for any token (not just
 * USDG). Used to show live "you own X dNVDA" after a fill.
 */
export function useErc20Balance(token: `0x${string}`): ReadResult<bigint> {
  const { address } = useAccount();
  const q = useReadContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: activeChain.id,
    query: {
      enabled: !!address && isDeployed(token),
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
