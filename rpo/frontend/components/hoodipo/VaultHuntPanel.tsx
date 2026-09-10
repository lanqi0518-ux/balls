"use client";

import { useMemo, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { toast } from "sonner";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight, Bolt } from "@/components/ui/Icons";
import { CONTRACTS, isDeployed, robinhoodChain } from "@/lib/chain";
import { STOCK_TOKENS } from "@/lib/robinhood/tokens";

/**
 * Interactive panel for opening a pre-mint vault. When
 * `CONTRACTS.preMintFactory` is set, it's ready to `announce()` on
 * chain; when it's the zero address (deployment pending), the panel
 * gates every action with a clear notice instead of half-working.
 *
 * Design goals:
 *   * Never disable inputs silently — always explain why.
 *   * Never fabricate an on-chain state.
 *   * Prefill with a plausible near-term IPO candidate.
 */
export function VaultHuntPanel() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: switching } = useSwitchChain();

  const [ticker, setTicker] = useState("STRIPE");
  const [depositUsdg, setDepositUsdg] = useState("1000");
  const factoryLive = isDeployed(CONTRACTS.preMintFactory);
  const chainOk = !isConnected || chainId === robinhoodChain.id;

  // We won't hit an untyped ABI call before the factory is deployed —
  // the UI simply reflects the state and prompts the user with a
  // GitHub link so they can inspect the source before deployment.
  const canonicalKnown = useMemo(
    () => STOCK_TOKENS.some((t) => t.ticker.toUpperCase() === ticker.toUpperCase()),
    [ticker]
  );

  async function onAction() {
    if (!factoryLive) {
      toast.warning(
        "PreMintFactory not yet deployed on Robinhood Chain. Contract source is verified on GitHub — deploy tx will unlock this action."
      );
      return;
    }
    if (!isConnected) return;
    if (!chainOk) {
      await switchChainAsync({ chainId: robinhoodChain.id });
      return;
    }
    // Placeholder — actual write path lands the day PreMintFactory
    // is deployed; wagmi write hook plugs in here.
    toast.success(
      `Would announce(${ticker.toUpperCase()}) on PreMintFactory ${CONTRACTS.preMintFactory.slice(0, 6)}… — sim only right now.`
    );
  }

  return (
    <div className="card-soft p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
            Hunt / Subscribe
          </div>
          <div className="text-2xl font-display text-ink-900 mt-1">
            Open a PreMintVault
          </div>
        </div>
        <Badge variant={factoryLive ? "forest" : "peach"}>
          {factoryLive ? "Factory live" : "Factory pending deploy"}
        </Badge>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
            Ticker to hunt
          </label>
          <div className="mt-2 rounded-xl border border-line bg-paper-100 p-4 flex items-center justify-between">
            <input
              value={ticker}
              onChange={(e) =>
                setTicker(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 12))
              }
              placeholder="STRIPE"
              className="bg-transparent text-3xl font-mono text-ink-900 tabular-nums outline-none w-full"
            />
            <span className="badge">HUNT</span>
          </div>
          <p className="text-[11px] text-ink-500 mt-2">
            {canonicalKnown ? (
              <>
                <b>Note:</b> {ticker.toUpperCase()} is already a live
                Robinhood Stock Token — a PreMintVault would fulfill
                immediately at the current pool mid. Prefer a ticker
                that&rsquo;s <b>not yet minted</b> (e.g. STRIPE, DBRX,
                XAI, ANTHROPIC).
              </>
            ) : (
              <>
                One CREATE2 vault per (ticker, day). Pot fulfills the
                block Robinhood publishes {ticker.toUpperCase()} in
                its RHJ Reg-S catalog.
              </>
            )}
          </p>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
            Deposit
          </label>
          <div className="mt-2 rounded-xl border border-line bg-paper-100 p-4 flex items-center justify-between">
            <input
              value={depositUsdg}
              onChange={(e) => setDepositUsdg(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="1000"
              inputMode="decimal"
              className="bg-transparent text-3xl font-mono text-ink-900 tabular-nums outline-none w-full"
            />
            <span className="badge">USDG</span>
          </div>
          <p className="text-[11px] text-ink-500 mt-2">
            Deposits sit in the vault. You can{" "}
            <code className="font-mono text-[10px] bg-paper-100 px-1 py-0.5 rounded">
              cancel()
            </code>{" "}
            at any time before <b>fulfill</b> and pull USDG 1:1.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-white p-4 grid grid-cols-3 gap-4 text-xs">
          <Cell k="Sub window" v="24 h" />
          <Cell k="Fulfill grace" v="30 d" />
          <Cell k="Refund path" v="1:1 USDG" />
          <Cell k="Fee" v="≤ 5% (immut.)" />
          <Cell k="Keeper bounty" v="≤ 2% of pot" />
          <Cell k="Slippage floor" v="Chainlink" />
        </div>

        <div className="pt-2 flex gap-2">
          {!isConnected ? (
            <ConnectButton />
          ) : !chainOk ? (
            <Button onClick={onAction} disabled={switching}>
              {switching ? "Switching…" : "Switch to Robinhood Chain"}
            </Button>
          ) : (
            <Button
              onClick={onAction}
              variant={factoryLive ? "primary" : "outline"}
              trailingIcon={<Bolt className="h-4 w-4" />}
            >
              {factoryLive
                ? `announce("${ticker || "…"}") + subscribe`
                : `Preview announce("${ticker || "…"}")`}
            </Button>
          )}
          <a
            href="https://github.com/lanqi0518-ux/hoodipo/blob/main/rpo/contracts/src/hoodipo/PreMintFactory.sol"
            target="_blank"
            rel="noreferrer"
            className="btn-outline text-sm inline-flex items-center gap-1"
          >
            Read the .sol
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
        {k}
      </div>
      <div className="text-sm font-mono text-ink-900 mt-0.5">{v}</div>
    </div>
  );
}
