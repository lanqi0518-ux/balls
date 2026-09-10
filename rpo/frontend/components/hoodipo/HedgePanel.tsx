"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Shield } from "@/components/ui/Icons";
import { CONTRACTS, isDeployed } from "@/lib/chain";
import { STOCK_TOKENS } from "@/lib/robinhood/tokens";

export function HedgePanel() {
  const { isConnected } = useAccount();
  const [ticker, setTicker] = useState("CRCL");
  const [amount, setAmount] = useState("50");
  const [strike, setStrike] = useState("100");
  const [slipBps, setSlipBps] = useState("100");
  const live = isDeployed(CONTRACTS.lockupHedge);
  const selected = useMemo(
    () => STOCK_TOKENS.find((t) => t.ticker === ticker),
    [ticker]
  );

  function open() {
    if (!live) {
      toast.warning(
        "LockupHedgeVault not yet deployed. Preview only until the deploy tx lands."
      );
      return;
    }
    toast.success(
      `Would open(${ticker}, ${amount}, ...) + armStopLoss(strike=$${strike})`
    );
  }

  return (
    <div className="card-soft p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
            Compose
          </div>
          <div className="text-2xl font-display text-ink-900 mt-1">
            Open a hedge + arm stop-loss
          </div>
        </div>
        <Badge variant={live ? "forest" : "peach"}>
          {live ? "Vault live" : "Vault pending deploy"}
        </Badge>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
            Token to hedge
          </label>
          <select
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-paper-100 p-4 text-lg text-ink-900 font-mono outline-none"
          >
            {STOCK_TOKENS.slice(0, 40).map((t) => (
              <option key={t.ticker} value={t.ticker}>
                d{t.ticker} — {t.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-ink-500 mt-2 font-mono">
            {selected?.address ?? "—"} · Chainlink feed{" "}
            {selected?.priceFeed ? "registered" : "not registered"}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
              Amount (tokens)
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="mt-2 w-full rounded-xl border border-line bg-paper-100 p-3 text-lg font-mono text-ink-900 outline-none"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
              Strike (USD)
            </label>
            <input
              value={strike}
              onChange={(e) => setStrike(e.target.value.replace(/[^0-9.]/g, ""))}
              className="mt-2 w-full rounded-xl border border-line bg-paper-100 p-3 text-lg font-mono text-ink-900 outline-none"
            />
            <p className="text-[11px] text-ink-500 mt-1">
              Chainlink strike, 8-dec
            </p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
              Max slippage
            </label>
            <input
              value={slipBps}
              onChange={(e) => setSlipBps(e.target.value.replace(/[^0-9]/g, ""))}
              className="mt-2 w-full rounded-xl border border-line bg-paper-100 p-3 text-lg font-mono text-ink-900 outline-none"
            />
            <p className="text-[11px] text-ink-500 mt-1">
              bps; ≤ 1000
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-paper-100 border border-line p-4 text-[11px] font-mono text-ink-900 leading-relaxed overflow-x-auto">
          <pre>{`vault.open(
  token:  d${ticker}       (${selected?.address ?? "0x…"}),
  amount: ${amount || 0}e18,
  lockupExpiry: keeper-supplied unix
);
vault.armStopLoss(
  id, strikeUsd8: ${strike || 0}e8, maxSlippageBps: ${slipBps || 0}
);`}</pre>
        </div>

        <div className="flex gap-2">
          {!isConnected ? (
            <ConnectButton />
          ) : (
            <Button
              onClick={open}
              variant={live ? "primary" : "outline"}
              trailingIcon={<Shield className="h-4 w-4" />}
            >
              {live ? "open() + arm()" : "Preview open() + arm()"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
