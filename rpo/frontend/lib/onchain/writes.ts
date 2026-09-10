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
