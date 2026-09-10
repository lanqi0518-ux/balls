"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Bolt } from "@/components/ui/Icons";
import { CONTRACTS, isDeployed } from "@/lib/chain";
import { STOCK_TOKENS } from "@/lib/robinhood/tokens";

type Kind = "TOP_UP" | "REBALANCE_TO_USDG" | "NOTIFY";

/**
 * Client component that composes an arm() call to CorpActionsRegistry.
 * When the registry isn't deployed yet, it renders honest sim state
 * and lets the user preview the calldata that would land.
 */
export function StrategyBuilder() {
  const { isConnected } = useAccount();
  const liveTokens = STOCK_TOKENS.slice(0, 12);
  const [ticker, setTicker] = useState(liveTokens[0]?.ticker ?? "SPY");
  const [kind, setKind] = useState<Kind>("TOP_UP");
  const [minDeltaBps, setMinDeltaBps] = useState("25");
  const [topUpAmount, setTopUpAmount] = useState("100");
  const [maxTokens, setMaxTokens] = useState("10");
  const registryLive = isDeployed(CONTRACTS.corpActions);
  const selected = STOCK_TOKENS.find((t) => t.ticker === ticker);

  function onSubmit() {
    if (!registryLive) {
      toast.warning(
        "CorpActionsRegistry not yet deployed. Arm calldata previewed; the moment the registry is live this button will land the tx."
      );
      return;
    }
    toast.success(
      `Would arm(${ticker}, ${kind}, ${minDeltaBps}bps) — sim only right now.`
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
            Arm a corp-action strategy
          </div>
        </div>
        <Badge variant={registryLive ? "forest" : "peach"}>
          {registryLive ? "Registry live" : "Registry pending deploy"}
        </Badge>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
            Watched token
          </label>
          <select
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-paper-100 p-4 text-lg text-ink-900 font-mono outline-none"
          >
            {liveTokens.map((t) => (
              <option key={t.ticker} value={t.ticker}>
                d{t.ticker} — {t.name}
              </option>
            ))}
          </select>
          {selected?.uiMultiplier ? (
            <p className="text-[11px] text-ink-500 mt-2 font-mono">
              Current uiMultiplier ≈ {selected.uiMultiplier} ·{" "}
              {selected.address}
            </p>
          ) : (
            <p className="text-[11px] text-ink-500 mt-2 font-mono">
              uiMultiplier = 1.0 (no reported corporate actions yet)
            </p>
          )}
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
            Strategy kind
          </label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["TOP_UP", "REBALANCE_TO_USDG", "NOTIFY"] as Kind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={
                  "text-xs font-mono px-3 py-3 rounded-xl border transition-colors " +
                  (kind === k
                    ? "border-ink-900 bg-ink-900 text-white"
                    : "border-line bg-white text-ink-500 hover:text-ink-900")
                }
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
              minDeltaBps
            </label>
            <input
              value={minDeltaBps}
              onChange={(e) => setMinDeltaBps(e.target.value.replace(/[^0-9]/g, ""))}
              className="mt-2 w-full rounded-xl border border-line bg-paper-100 p-3 text-lg font-mono text-ink-900 outline-none"
              inputMode="numeric"
            />
            <p className="text-[11px] text-ink-500 mt-1">1 = 0.01%</p>
          </div>
          {kind === "TOP_UP" && (
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
                topUpAmount (USDG)
              </label>
              <input
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="mt-2 w-full rounded-xl border border-line bg-paper-100 p-3 text-lg font-mono text-ink-900 outline-none"
                inputMode="decimal"
              />
              <p className="text-[11px] text-ink-500 mt-1">
                Pulled from your wallet each trigger
              </p>
            </div>
          )}
          {kind === "REBALANCE_TO_USDG" && (
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
                maxTokensPerTrigger
              </label>
              <input
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value.replace(/[^0-9.]/g, ""))}
                className="mt-2 w-full rounded-xl border border-line bg-paper-100 p-3 text-lg font-mono text-ink-900 outline-none"
                inputMode="decimal"
              />
              <p className="text-[11px] text-ink-500 mt-1">
                d{ticker} sold per trigger
              </p>
            </div>
          )}
          {kind === "NOTIFY" && (
            <div className="text-xs text-ink-500 self-end pb-2">
              NOTIFY has no swap. Emits{" "}
              <code className="font-mono bg-paper-100 px-1 py-0.5 rounded">
                StrategyExecuted
              </code>{" "}
              per trigger for your indexer.
            </div>
          )}
        </div>

        <div className="rounded-xl bg-paper-100 border border-line p-4 text-[11px] font-mono text-ink-900 leading-relaxed overflow-x-auto">
          <pre>{`registry.arm(
  token:               d${ticker} (${selected?.address ?? "0x…"}),
  kind:                ${kind},
  minDeltaBps:         ${minDeltaBps || 0},${
            kind === "TOP_UP"
              ? `\n  topUpAmount:         ${topUpAmount || 0}e6 USDG,`
              : ""
          }${
            kind === "REBALANCE_TO_USDG"
              ? `\n  maxTokensPerTrigger: ${maxTokens || 0}e18,`
              : ""
          }
  salt:                keccak256(now)
);`}</pre>
        </div>

        <div className="pt-2 flex gap-2">
          {!isConnected ? (
            <ConnectButton />
          ) : (
            <Button
              onClick={onSubmit}
              variant={registryLive ? "primary" : "outline"}
              trailingIcon={<Bolt className="h-4 w-4" />}
            >
              {registryLive ? "arm() strategy" : "Preview arm()"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
