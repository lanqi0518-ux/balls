"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

type Options = {
  loading: string;
  success: string;
  errorLabel?: string;
  /** Simulated on-chain latency in ms. */
  latencyMs?: number;
  /** Optional simulated failure probability (0-1). */
  failRate?: number;
};

/**
 * Wrap an action in a simulated transaction: pending toast → success/error
 * toast, plus a `pending` state for disabling buttons.
 *
 * In production this would await `writeContract`; here we simulate a
 * plausible latency so the UI behaves the same way.
 */
export function useTx() {
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (action: () => void | Promise<void>, opts: Options) => {
      const latency = opts.latencyMs ?? 1_100;
      const failRate = opts.failRate ?? 0;
      setPending(true);
      const toastId = toast.loading(opts.loading);
      try {
        await new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            if (Math.random() < failRate) reject(new Error("Simulated fail"));
            else resolve();
          }, latency);
        });
        await action();
        toast.success(opts.success, { id: toastId });
      } catch (e) {
        toast.error(opts.errorLabel ?? "Transaction failed", { id: toastId });
      } finally {
        setPending(false);
      }
    },
    []
  );

  return { pending, run };
}
