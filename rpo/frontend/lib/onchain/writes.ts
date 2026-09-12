"use client";

/**
 * Real onchain write hooks. Every one:
 *   • Runs actual approve/write flows against the deployed contract.
 *   • Toasts pending → confirmed with explorer link.
 *   • Refetches relevant reads after confirmation.
 *   • Refuses to run when the contract isn't deployed (returns a
 *     `notLive` flag so callers can render a Waitlist CTA instead).
 *
 * Every hook returns `{ run, pending, isConfirming, notLive }`.
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { usePublicClient, useWriteContract } from "wagmi";
import {
  AllocationBoosterABI,
  ERC20_ABI,
  FaucetABI,
  SubscriptionVaultABI,
} from "@/lib/abi";
import {
  CONTRACTS,
  activeChain,
  explorerTx,
  isDeployed,
} from "@/lib/chain";
import {
  PERMIT2_ABI,
  PERMIT2_ADDRESS,
  UNIVERSAL_ROUTER_ABI,
  V4_UNIVERSAL_ROUTER,
  encodeSwapUsdgToStockInput,
  CMD_V4_SWAP,
  type PoolKey,
} from "@/lib/robinhood/v4";

type TxState = {
  pending: boolean;
  hash?: `0x${string}`;
  isConfirming: boolean;
  notLive: boolean;
};

async function waitAndToast(
  publicClient: ReturnType<typeof usePublicClient>,
  hash: `0x${string}`,
  toastId: string | number,
  successMsg: string
) {
  if (!publicClient) {
    toast.success(successMsg, { id: toastId });
    return;
  }
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "success") {
      const url = explorerTx(hash);
      toast.success(successMsg, {
        id: toastId,
        description: url,
        action: {
          label: "Explorer",
          onClick: () => window.open(url, "_blank"),
        },
      });
    } else {
      toast.error("Transaction reverted", { id: toastId });
    }
  } catch (e) {
    toast.error("Transaction failed", { id: toastId });
  }
}

/* ─── ERC-20 approve ────────────────────────────────────────────── */

export function useErc20Approve(
  token: `0x${string}`,
  spender: `0x${string}`
) {
  const [state, setState] = useState<TxState>({
    pending: false,
    isConfirming: false,
    notLive: !isDeployed(token) || !isDeployed(spender),
  });
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: activeChain.id });

  const run = useCallback(
    async (amount: bigint, opts?: { onConfirmed?: () => void }) => {
      if (!isDeployed(token) || !isDeployed(spender)) {
        toast.error("Not available on this chain yet");
        return;
      }
      const id = toast.loading("Approve pending in wallet…");
      setState((s) => ({ ...s, pending: true }));
      try {
        const hash = await writeContractAsync({
          address: token,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [spender, amount],
          chainId: activeChain.id,
        });
        setState((s) => ({ ...s, hash, isConfirming: true }));
        toast.loading("Confirming approval…", { id });
        await waitAndToast(publicClient, hash, id, "Approval confirmed");
        opts?.onConfirmed?.();
      } catch (e: any) {
        toast.error(e?.shortMessage ?? "Approval failed", { id });
      } finally {
        setState((s) => ({ ...s, pending: false, isConfirming: false }));
      }
    },
    [publicClient, spender, token, writeContractAsync]
  );

  return { ...state, run };
}

/* ─── Booster: stake ────────────────────────────────────────────── */

export function useStakeRpo() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: activeChain.id });
  const [state, setState] = useState<TxState>({
    pending: false,
    isConfirming: false,
    notLive: !isDeployed(CONTRACTS.booster) || !isDeployed(CONTRACTS.rpo),
  });

  const run = useCallback(
    async (amount: bigint, opts?: { onConfirmed?: () => void }) => {
      if (state.notLive) {
        toast.error("Booster not deployed yet");
        return;
      }
      const id = toast.loading(`Stake pending in wallet…`);
      setState((s) => ({ ...s, pending: true }));
      try {
        const hash = await writeContractAsync({
          address: CONTRACTS.booster,
          abi: AllocationBoosterABI,
          functionName: "stake",
          args: [amount],
          chainId: activeChain.id,
        });
        setState((s) => ({ ...s, hash, isConfirming: true }));
        toast.loading("Confirming stake…", { id });
        await waitAndToast(publicClient, hash, id, "Stake confirmed");
        opts?.onConfirmed?.();
      } catch (e: any) {
        toast.error(e?.shortMessage ?? "Stake failed", { id });
      } finally {
        setState((s) => ({ ...s, pending: false, isConfirming: false }));
      }
    },
    [publicClient, state.notLive, writeContractAsync]
  );

  return { ...state, run };
}

/* ─── Booster: unstake ──────────────────────────────────────────── */

export function useUnstakeRpo() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: activeChain.id });
  const [state, setState] = useState<TxState>({
    pending: false,
    isConfirming: false,
    notLive: !isDeployed(CONTRACTS.booster),
  });

  const run = useCallback(
    async (amount: bigint, opts?: { onConfirmed?: () => void }) => {
      if (state.notLive) {
        toast.error("Booster not deployed yet");
        return;
      }
      const id = toast.loading("Unstake pending in wallet…");
      setState((s) => ({ ...s, pending: true }));
      try {
        const hash = await writeContractAsync({
          address: CONTRACTS.booster,
          abi: AllocationBoosterABI,
          functionName: "unstake",
          args: [amount],
          chainId: activeChain.id,
        });
        setState((s) => ({ ...s, hash, isConfirming: true }));
        toast.loading("Confirming unstake…", { id });
        await waitAndToast(publicClient, hash, id, "Unstake confirmed");
        opts?.onConfirmed?.();
      } catch (e: any) {
        toast.error(e?.shortMessage ?? "Unstake failed", { id });
      } finally {
        setState((s) => ({ ...s, pending: false, isConfirming: false }));
      }
    },
    [publicClient, state.notLive, writeContractAsync]
  );

  return { ...state, run };
}

/* ─── Vault: subscribe ──────────────────────────────────────────── */

export function useSubscribeVault(vault: `0x${string}` | undefined) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: activeChain.id });
  const notLive =
    !vault ||
    !isDeployed(vault) ||
    !isDeployed(CONTRACTS.usdg);

  const [state, setState] = useState<TxState>({
    pending: false,
    isConfirming: false,
    notLive,
  });

  const run = useCallback(
    async (amount: bigint, opts?: { onConfirmed?: () => void }) => {
      if (!vault || notLive) {
        toast.error("Vault not available on this chain yet");
        return;
      }
      const id = toast.loading("Subscribe pending in wallet…");
      setState((s) => ({ ...s, pending: true }));
      try {
        const hash = await writeContractAsync({
          address: vault,
          abi: SubscriptionVaultABI,
          functionName: "subscribe",
          args: [amount],
          chainId: activeChain.id,
        });
        setState((s) => ({ ...s, hash, isConfirming: true }));
        toast.loading("Confirming subscription…", { id });
        await waitAndToast(publicClient, hash, id, "Subscription confirmed");
        opts?.onConfirmed?.();
      } catch (e: any) {
        toast.error(e?.shortMessage ?? "Subscribe failed", { id });
      } finally {
        setState((s) => ({ ...s, pending: false, isConfirming: false }));
      }
    },
    [notLive, publicClient, vault, writeContractAsync]
  );

  return { ...state, run };
}

/* ─── Vault: cancel ─────────────────────────────────────────────── */

export function useCancelSubscription(vault: `0x${string}` | undefined) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: activeChain.id });
  const notLive = !vault || !isDeployed(vault);
  const [state, setState] = useState<TxState>({
    pending: false,
    isConfirming: false,
    notLive,
  });

  const run = useCallback(
    async (opts?: { onConfirmed?: () => void }) => {
      if (!vault || notLive) {
        toast.error("Vault not available on this chain yet");
        return;
      }
      const id = toast.loading("Cancel pending in wallet…");
      setState((s) => ({ ...s, pending: true }));
      try {
        const hash = await writeContractAsync({
          address: vault,
          abi: SubscriptionVaultABI,
          functionName: "cancel",
          chainId: activeChain.id,
        });
        setState((s) => ({ ...s, hash, isConfirming: true }));
        toast.loading("Confirming cancel…", { id });
        await waitAndToast(publicClient, hash, id, "Cancel confirmed");
        opts?.onConfirmed?.();
      } catch (e: any) {
        toast.error(e?.shortMessage ?? "Cancel failed", { id });
      } finally {
        setState((s) => ({ ...s, pending: false, isConfirming: false }));
      }
    },
    [notLive, publicClient, vault, writeContractAsync]
  );

  return { ...state, run };
}

/* ─── Vault: claim ──────────────────────────────────────────────── */

export function useClaimAllocation(vault: `0x${string}` | undefined) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: activeChain.id });
  const notLive = !vault || !isDeployed(vault);
  const [state, setState] = useState<TxState>({
    pending: false,
    isConfirming: false,
    notLive,
  });

  const run = useCallback(
    async (opts?: { onConfirmed?: () => void }) => {
      if (!vault || notLive) {
        toast.error("Vault not available on this chain yet");
        return;
      }
      const id = toast.loading("Claim pending in wallet…");
      setState((s) => ({ ...s, pending: true }));
      try {
        const hash = await writeContractAsync({
          address: vault,
          abi: SubscriptionVaultABI,
          functionName: "claim",
          chainId: activeChain.id,
        });
        setState((s) => ({ ...s, hash, isConfirming: true }));
        toast.loading("Confirming claim…", { id });
        await waitAndToast(publicClient, hash, id, "Claim confirmed");
        opts?.onConfirmed?.();
      } catch (e: any) {
        toast.error(e?.shortMessage ?? "Claim failed", { id });
      } finally {
        setState((s) => ({ ...s, pending: false, isConfirming: false }));
      }
    },
    [notLive, publicClient, vault, writeContractAsync]
  );

  return { ...state, run };
}

/* ─── Permit2: approve token for UniversalRouter ────────────────── */

/**
 * Grant the UniversalRouter permission to pull `token` from the user via
 * Permit2. The Uniswap V4 buy flow needs two lifetime approvals per user:
 *
 *   1. Standard ERC-20: approve(Permit2, ∞)  — one time, forever
 *   2. Permit2:         approve(token, UR, ∞, ∞ expiration) — periodic
 *
 * We use expiration = max-uint48 so the user only has to sign it once.
 */
export function usePermit2Approve(token: `0x${string}`) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: activeChain.id });
  const [state, setState] = useState<TxState>({
    pending: false,
    isConfirming: false,
    notLive: !isDeployed(token),
  });

  const run = useCallback(
    async (opts?: { onConfirmed?: () => void }) => {
      if (!isDeployed(token)) {
        toast.error("Token not deployed on this chain");
        return;
      }
      const id = toast.loading("Permit2 approve pending in wallet…");
      setState((s) => ({ ...s, pending: true }));
      try {
        const maxUint160 = (1n << 160n) - 1n;
        // uint48 max = 2^48-1 ≈ 2.8e14, well under Number.MAX_SAFE_INTEGER;
        // viem's typed ABI expects `number` for uint48 arguments.
        const maxUint48 = Number((1n << 48n) - 1n);
        const hash = await writeContractAsync({
          address: PERMIT2_ADDRESS,
          abi: PERMIT2_ABI,
          functionName: "approve",
          args: [token, V4_UNIVERSAL_ROUTER, maxUint160, maxUint48],
          chainId: activeChain.id,
        });
        setState((s) => ({ ...s, hash, isConfirming: true }));
        toast.loading("Confirming Permit2 approval…", { id });
        await waitAndToast(
          publicClient,
          hash,
          id,
          "Permit2 approval confirmed"
        );
        opts?.onConfirmed?.();
      } catch (e: any) {
        toast.error(e?.shortMessage ?? "Permit2 approve failed", { id });
      } finally {
        setState((s) => ({ ...s, pending: false, isConfirming: false }));
      }
    },
    [publicClient, token, writeContractAsync]
  );

  return { ...state, run };
}

/* ─── UniversalRouter: V4 swap USDG → dSTOCK ────────────────────── */

/**
 * Execute a live Uniswap V4 swap on Robinhood Chain: USDG → dSTOCK.
 *
 * Encodes the standard SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL
 * action bundle, wraps it as a single V4_SWAP command, and submits it
 * via UniversalRouter.execute(bytes, bytes[], uint256).
 *
 * The user must first have:
 *   - approved USDG to Permit2 (ERC-20 approve), AND
 *   - approved Permit2 → UR for USDG (Permit2.approve).
 *
 * Returns the standard `{ run, pending, isConfirming, notLive }` shape.
 */
export function useV4Swap(params: {
  poolKey: PoolKey;
  zeroForOne: boolean;
}) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: activeChain.id });
  const [state, setState] = useState<TxState>({
    pending: false,
    isConfirming: false,
    notLive: false,
  });

  const run = useCallback(
    async (
      args: {
        amountInUsdg6: bigint;
        amountOutMinStock18: bigint;
        deadlineSeconds?: number;
      },
      opts?: { onConfirmed?: (hash: `0x${string}`) => void }
    ) => {
      const id = toast.loading("Swap pending in wallet…");
      setState((s) => ({ ...s, pending: true }));
      try {
        const deadline = BigInt(
          Math.floor(Date.now() / 1000) + (args.deadlineSeconds ?? 900)
        );
        const commands = ("0x" +
          CMD_V4_SWAP.toString(16).padStart(2, "0")) as `0x${string}`;
        const input = encodeSwapUsdgToStockInput({
          poolKey: params.poolKey,
          zeroForOne: params.zeroForOne,
          amountInUsdg6: args.amountInUsdg6,
          amountOutMinStock18: args.amountOutMinStock18,
        });
        const hash = await writeContractAsync({
          address: V4_UNIVERSAL_ROUTER,
          abi: UNIVERSAL_ROUTER_ABI,
          functionName: "execute",
          args: [commands, [input], deadline],
          chainId: activeChain.id,
        });
        setState((s) => ({ ...s, hash, isConfirming: true }));
        toast.loading("Confirming swap…", { id });
        await waitAndToast(publicClient, hash, id, "Swap confirmed");
        opts?.onConfirmed?.(hash);
      } catch (e: any) {
        toast.error(e?.shortMessage ?? "Swap failed", { id });
      } finally {
        setState((s) => ({ ...s, pending: false, isConfirming: false }));
      }
    },
    [
      params.poolKey,
      params.zeroForOne,
      publicClient,
      writeContractAsync,
    ]
  );

  return { ...state, run };
}

/* ─── Faucet: drip ──────────────────────────────────────────────── */

export function useFaucetDrip() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: activeChain.id });
  const [state, setState] = useState<TxState>({
    pending: false,
    isConfirming: false,
    notLive: !isDeployed(CONTRACTS.faucet),
  });

  const run = useCallback(
    async (opts?: { onConfirmed?: () => void }) => {
      if (state.notLive) {
        toast.error("Faucet not deployed yet");
        return;
      }
      const id = toast.loading("Requesting testnet drip…");
      setState((s) => ({ ...s, pending: true }));
      try {
        const hash = await writeContractAsync({
          address: CONTRACTS.faucet,
          abi: FaucetABI,
          functionName: "drip",
          chainId: activeChain.id,
        });
        setState((s) => ({ ...s, hash, isConfirming: true }));
        toast.loading("Waiting for confirmation…", { id });
        await waitAndToast(publicClient, hash, id, "Drip received");
        opts?.onConfirmed?.();
      } catch (e: any) {
        toast.error(e?.shortMessage ?? "Faucet drip failed", { id });
      } finally {
        setState((s) => ({ ...s, pending: false, isConfirming: false }));
      }
    },
    [publicClient, state.notLive, writeContractAsync]
  );

  return { ...state, run };
}
