"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight, Coin } from "@/components/ui/Icons";

/**
 * Interactive preview of a physical-delivery prediction market.
 * Renders both sides of the bet with real implied-probability math
 * so the user can play with sizing before any market is deployed.
 */
export function PredictionMarketPreview() {
  const { isConnected } = useAccount();
  const [yesPool, setYesPool] = useState(65_000);
  const [noPool, setNoPool] = useState(35_000);
  const [betSize, setBetSize] = useState("500");
  const [side, setSide] = useState<"YES" | "NO">("YES");

  const totalPool = yesPool + noPool;
  const impliedYesBps = Math.round((yesPool / totalPool) * 10_000);
  const impliedNoBps = 10_000 - impliedYesBps;
  const size = Number(betSize) || 0;

  // If YES wins and pot buys d-TICKER at implied YES price,
  // YES holders share the token pot proportional to their stake.
  const projectedYesTokens =
    side === "YES" && size > 0
      ? ((totalPool + size) * (size / (yesPool + size))) /
        Math.max(1, (yesPool + size) * (impliedYesBps / 10_000))
      : 0;

  function place() {
    setSide((s) => s); // no-op unless linked
    toast.warning(
      "Prediction markets are per-market CREATE deployments — the pool factory + first market will land in the next deploy tx."
    );
  }

  return (
    <div className="card-soft p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
            Preview market
          </div>
          <div className="text-2xl font-display text-ink-900 mt-1">
            Will Robinhood mint d-STRIPE before 2026-12-31?
          </div>
        </div>
        <Badge variant="peach">Sim only</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setSide("YES")}
          className={
            "rounded-2xl p-5 border-2 transition-all text-left " +
            (side === "YES"
              ? "border-forest-500 bg-forest-50"
              : "border-line bg-white hover:border-line-strong")
          }
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
            YES · physical
          </div>
          <div className="mt-1 text-2xl font-mono text-ink-900 tabular-nums">
            {(impliedYesBps / 100).toFixed(1)}¢
          </div>
          <div className="text-[11px] text-ink-500 mt-1">
            Redeems as real d-STRIPE
          </div>
        </button>
        <button
          onClick={() => setSide("NO")}
          className={
            "rounded-2xl p-5 border-2 transition-all text-left " +
            (side === "NO"
              ? "border-ink-900 bg-ink-900 text-white"
              : "border-line bg-white hover:border-line-strong")
          }
        >
          <div
            className={
              "text-[10px] uppercase tracking-[0.18em] font-mono " +
              (side === "NO" ? "text-white/70" : "text-ink-500")
            }
          >
            NO · USDG
          </div>
          <div
            className={
              "mt-1 text-2xl font-mono tabular-nums " +
              (side === "NO" ? "text-white" : "text-ink-900")
            }
          >
            {(impliedNoBps / 100).toFixed(1)}¢
          </div>
          <div
            className={
              "text-[11px] mt-1 " +
              (side === "NO" ? "text-white/70" : "text-ink-500")
            }
          >
            Redeems 1:1 USDG
          </div>
        </button>
      </div>

      <div className="mb-6">
        <label className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
          Bet size
        </label>
        <div className="mt-2 rounded-xl border border-line bg-paper-100 p-4 flex items-center justify-between">
          <input
            value={betSize}
            onChange={(e) => setBetSize(e.target.value.replace(/[^0-9.]/g, ""))}
            className="bg-transparent text-3xl font-mono text-ink-900 tabular-nums outline-none w-full"
            inputMode="decimal"
          />
          <span className="badge">USDG</span>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-4 space-y-2 text-sm mb-6">
        <Row
          k="If YES resolves"
          v={
            side === "YES"
              ? `~${projectedYesTokens.toFixed(4)} d-STRIPE claim`
              : "You lose your NO stake"
          }
          tone={side === "YES" ? "forest" : undefined}
        />
        <Row
          k="If NO resolves"
          v={side === "NO" ? `${size.toLocaleString()} USDG back (1:1)` : "You lose your YES stake"}
          tone={side === "NO" ? "forest" : undefined}
        />
        <Row k="Platform fee at resolve" v="2%" />
        <Row k="Deadline" v="2026-12-31 · resolveNo() opens 00:00 UTC" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 text-xs text-ink-500">
        <div>
          Pool tuning · YES USDG
          <input
            type="range"
            min={1000}
            max={200_000}
            value={yesPool}
            onChange={(e) => setYesPool(Number(e.target.value))}
            className="w-full mt-1"
          />
        </div>
        <div>
          Pool tuning · NO USDG
          <input
            type="range"
            min={1000}
            max={200_000}
            value={noPool}
            onChange={(e) => setNoPool(Number(e.target.value))}
            className="w-full mt-1"
          />
        </div>
      </div>

      <div className="flex gap-2">
        {!isConnected ? (
          <ConnectButton />
        ) : (
          <Button
            onClick={place}
            variant="outline"
            trailingIcon={<Coin className="h-4 w-4" />}
          >
            Preview bet{side}({size.toLocaleString()} USDG)
          </Button>
        )}
        <a
          href="https://github.com/lanqi0518-ux/hoodipo/blob/main/rpo/contracts/src/hoodipo/PhysicalPredictionMarket.sol"
          target="_blank"
          rel="noreferrer"
          className="btn-outline text-sm inline-flex items-center gap-1"
        >
          Read the .sol
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function Row({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: "forest";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{k}</span>
      <span
        className={
          tone === "forest"
            ? "text-forest-500 font-mono tabular-nums font-semibold"
            : "text-ink-900 font-mono tabular-nums"
        }
      >
        {v}
      </span>
    </div>
  );
}
