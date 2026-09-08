"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Check, ArrowUpRight, Shield, Lock, Bolt } from "@/components/ui/Icons";

export default function SubscribePage({
  params,
}: {
  params: { ticker: string };
}) {
  const ticker = params.ticker.toUpperCase();
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState("500");
  const [payToken, setPayToken] = useState("USDG");

  const expected = amount ? (parseFloat(amount) / 85).toFixed(4) : "0";
  const fee = amount ? (parseFloat(amount) * 0.02).toFixed(2) : "0";
  const yieldEst = amount
    ? ((parseFloat(amount) * 0.04) / 365 * 3).toFixed(2)
    : "0";

  return (
    <div className="p-5 lg:p-10 max-w-6xl">
      <Link
        href="/app"
        className="text-sm text-fg-muted hover:text-fg inline-flex items-center gap-1 mb-8"
      >
        ← Back to calendar
      </Link>

      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="card p-8">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-mint-500 to-mint-400 flex items-center justify-center text-ink-950 font-bold text-lg">
                {ticker.slice(0, 2)}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-fg">
                  {ticker} IPO
                </h1>
                <div className="text-sm text-fg-muted">
                  d{ticker} · Reg-S Stock Token · underlying: 1 {ticker} share
                </div>
              </div>
              <Badge variant="forest" dot className="ml-auto">
                Subscribing
              </Badge>
            </div>

            <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
              <Stat k="Expected price" v="$85.20" />
              <Stat k="Subscribed" v="$2.31M" />
              <Stat k="Target" v="$5.00M" />
              <Stat k="Launch in" v="3d 4h" tone="mint" />
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-fg-muted mb-2">
                <span>Progress</span>
                <span className="font-mono">46%</span>
              </div>
              <div className="h-1.5 rounded-full bg-paper-200 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-forest-500 to-peach-500"
                  style={{ width: "46%" }}
                />
              </div>
            </div>
          </div>

          <div className="card p-8">
            <h2 className="text-lg font-semibold text-fg mb-4">
              What you&apos;re actually buying
            </h2>
            <ul className="space-y-3 text-sm text-fg-muted">
              {[
                "A Reg-S debt security issued by RHJ, redeemable 1:1 against 1 share of the underlying US-listed equity.",
                "An ERC-8056 token — dividends and splits are applied automatically via uiMultiplier updates.",
                "Priced through Chainlink total-return feeds and quoted on Rialto propAMM + Uniswap V3.",
                "Not available to U.S., Canadian, U.K., Swiss, or U.A.E. residents per RHJ's Reg-S terms.",
              ].map((l) => (
                <li key={l} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-forest-500 mt-0.5 flex-shrink-0" />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <Guarantee Icon={Lock} title="Refundable" body="Anyone-can-refund if unfilled." />
            <Guarantee Icon={Shield} title="Non-custodial" body="Per-IPO CREATE2 vault. No admin key." />
            <Guarantee Icon={Bolt} title="Yield while waiting" body="~4% APY on idle USDG." />
          </div>
        </div>

        <aside className="lg:col-span-2">
          <div className="card-elevated p-6 lg:p-8 sticky top-24 space-y-6">
            <div>
              <label className="text-xs uppercase tracking-[0.14em] text-fg-dim mb-2 block">
                Amount to subscribe
              </label>
              <div className="rounded-xl bg-paper-100 border border-line p-4 flex items-center gap-3">
                <input
                  className="bg-transparent text-2xl font-mono text-fg outline-none flex-1 tabular-nums"
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  placeholder="500"
                  inputMode="decimal"
                />
                <select
                  className="bg-paper-100 border border-line rounded-lg px-3 py-1.5 text-sm text-fg"
                  value={payToken}
                  onChange={(e) => setPayToken(e.target.value)}
                >
                  <option value="USDG">USDG</option>
                  <option value="USDC-BASE">USDC · Base</option>
                  <option value="USDC-ARB">USDC · Arb</option>
                  <option value="ETH">ETH · Mainnet</option>
                </select>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-fg-dim">Balance: —</span>
                <div className="flex gap-2">
                  <button className="text-fg-muted hover:text-fg">25%</button>
                  <button className="text-fg-muted hover:text-fg">50%</button>
                  <button className="text-fg-muted hover:text-fg">MAX</button>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm border-t border-line pt-4">
              <Row k="Allocation" v={`~ ${expected} d${ticker}`} />
              <Row k="Your boost" v="2.5×" tone="mint" />
              <Row k="Platform fee (2%)" v={`$${fee}`} />
              <Row k="Yield while waiting" v={`+$${yieldEst}`} tone="mint" />
              <Row k="Refund if unfilled" v="100%" />
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={!isConnected}
              trailingIcon={<ArrowUpRight className="h-4 w-4" />}
            >
              {isConnected
                ? "Subscribe · 20 seconds"
                : "Connect wallet to subscribe"}
            </Button>

            <div className="text-[11px] text-fg-dim leading-relaxed">
              By subscribing you deposit USDG into a per-IPO CREATE2 vault. You
              can cancel any time until the subscription deadline. Full refund
              if the IPO doesn&apos;t launch by the fulfillment deadline.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: "mint";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-fg-dim">
        {k}
      </div>
      <div
        className={
          "text-xl font-mono tabular-nums mt-1 " +
          (tone === "mint" ? "text-forest-500" : "text-fg")
        }
      >
        {v}
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
  tone?: "mint";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg-muted">{k}</span>
      <span
        className={
          tone === "mint"
            ? "text-forest-500 font-mono tabular-nums"
            : "text-fg font-mono tabular-nums"
        }
      >
        {v}
      </span>
    </div>
  );
}

function Guarantee({
  Icon,
  title,
  body,
}: {
  Icon: (props: { className?: string }) => JSX.Element;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-4">
      <Icon className="h-4 w-4 text-forest-500 mb-3" />
      <div className="text-sm font-semibold text-fg">{title}</div>
      <div className="text-xs text-fg-muted mt-1 leading-relaxed">{body}</div>
    </div>
  );
}
