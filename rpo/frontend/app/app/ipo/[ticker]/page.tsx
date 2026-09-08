"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import {
  Check,
  ArrowUpRight,
  Shield,
  Lock,
  Bolt,
} from "@/components/ui/Icons";
import {
  computeBoost,
  findIPO,
  useDemoStore,
} from "@/lib/demoStore";
import { useCountdown } from "@/lib/useCountdown";
import { useTx } from "@/lib/useTx";
import { fmtUSD, fmtNum, fmtCountdown, pct } from "@/lib/format";

export default function SubscribePage({
  params,
}: {
  params: { ticker: string };
}) {
  const ipo = findIPO(params.ticker);
  if (!ipo) notFound();

  const ticker = ipo.ticker;
  const { isConnected } = useAccount();
  const {
    balanceUSDG,
    stakedRPO,
    totalStakedPool,
    subscriptions,
    subscribe,
  } = useDemoStore();
  const { pending, run } = useTx();

  const boost = computeBoost(stakedRPO, totalStakedPool);
  const remaining = useCountdown(ipo.launchAtMs);

  const [amountStr, setAmountStr] = useState("500");
  const [payToken, setPayToken] = useState<"USDG" | "USDC-BASE" | "USDC-ARB" | "ETH">(
    "USDG"
  );
  const amount = Number(amountStr) || 0;

  // Aggregate live "subscribed" number = seed + all user subscriptions to this ticker
  const userSubscribedToThis = subscriptions
    .filter((s) => s.ticker === ticker)
    .reduce((a, s) => a + s.amountUSDG, 0);
  const totalSubscribed = ipo.seedSubscribedUSD + userSubscribedToThis;
  const progress = pct(totalSubscribed, ipo.targetUSD);

  const expected = amount / ipo.expectedPrice;
  const fee = amount * 0.02;
  const yieldEst = (amount * 0.04) / 365 * Math.max(1, remaining / 86400);

  const validation = useMemo(() => {
    if (!isConnected) return { ok: false, hint: "Connect wallet to subscribe" };
    if (amount <= 0) return { ok: false, hint: "Enter an amount" };
    if (payToken === "USDG" && amount > balanceUSDG)
      return { ok: false, hint: `Insufficient USDG (have ${fmtUSD(balanceUSDG)})` };
    if (remaining <= 0)
      return { ok: false, hint: "Subscription window closed" };
    return { ok: true, hint: `Subscribe · ${fmtCountdown(20)} to confirm` };
  }, [isConnected, amount, balanceUSDG, payToken, remaining]);

  const handleSubscribe = () => {
    if (!validation.ok) return;
    run(
      () => subscribe(ticker, amount, boost),
      {
        loading: `Signing subscribe(${fmtUSD(amount)}) …`,
        success: `Subscribed ${fmtUSD(amount)} to ${ticker}`,
      }
    );
  };

  const setPreset = (frac: number) => {
    setAmountStr(String(Math.floor(balanceUSDG * frac)));
  };

  return (
    <div className="p-5 lg:p-10 max-w-6xl">
      <Link
        href="/app"
        className="text-sm text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 mb-8"
      >
        ← Back to calendar
      </Link>

      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="card p-8">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 flex items-center justify-center text-white font-bold text-lg">
                {ticker.slice(0, 2)}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-ink-900">
                  {ticker} IPO
                </h1>
                <div className="text-sm text-ink-500">
                  d{ticker} · Reg-S Stock Token · underlying: 1 {ticker} share
                </div>
              </div>
              <Badge
                variant={ipo.status === "Subscribing" ? "forest" : "default"}
                dot={ipo.status === "Subscribing"}
                className="ml-auto"
              >
                {ipo.status}
              </Badge>
            </div>

            <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
              <Stat k="Expected price" v={fmtUSD(ipo.expectedPrice)} />
              <Stat
                k="Subscribed"
                v={fmtUSD(totalSubscribed, { compact: true })}
              />
              <Stat k="Target" v={fmtUSD(ipo.targetUSD, { compact: true })} />
              <Stat
                k="Launch in"
                v={fmtCountdown(remaining)}
                tone="forest"
              />
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-ink-500 mb-2">
                <span>Progress</span>
                <span className="font-mono tabular-nums text-ink-900">
                  {progress}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-paper-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-forest-500 to-peach-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="card p-8">
            <h2 className="text-lg font-semibold text-ink-900 mb-4">
              What you&apos;re actually buying
            </h2>
            <ul className="space-y-3 text-sm text-ink-500">
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
            <Guarantee
              Icon={Lock}
              title="Refundable"
              body="Anyone-can-refund if unfilled."
            />
            <Guarantee
              Icon={Shield}
              title="Non-custodial"
              body="Per-IPO CREATE2 vault. No admin key."
            />
            <Guarantee
              Icon={Bolt}
              title="Yield while waiting"
              body="~4% APY on idle USDG."
            />
          </div>
        </div>

        <aside className="lg:col-span-2">
          <div className="card-floating p-6 lg:p-8 sticky top-24 space-y-6">
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-ink-500 mb-2 block">
                Amount to subscribe
              </label>
              <div className="rounded-xl bg-paper-100 border border-line p-4 flex items-center gap-3">
                <input
                  className="bg-transparent text-2xl font-mono text-ink-900 outline-none flex-1 tabular-nums placeholder:text-ink-400"
                  value={amountStr}
                  onChange={(e) =>
                    setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  placeholder="500"
                  inputMode="decimal"
                />
                <select
                  className="bg-white border border-line rounded-lg px-3 py-1.5 text-sm text-ink-900 cursor-pointer"
                  value={payToken}
                  onChange={(e) => setPayToken(e.target.value as typeof payToken)}
                >
                  <option value="USDG">USDG</option>
                  <option value="USDC-BASE">USDC · Base</option>
                  <option value="USDC-ARB">USDC · Arb</option>
                  <option value="ETH">ETH · Mainnet</option>
                </select>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-ink-500">
                  Balance: <span className="font-mono">{fmtUSD(balanceUSDG)}</span>
                </span>
                <div className="flex gap-2">
                  <button
                    className="text-ink-500 hover:text-ink-900"
                    onClick={() => setPreset(0.25)}
                  >
                    25%
                  </button>
                  <button
                    className="text-ink-500 hover:text-ink-900"
                    onClick={() => setPreset(0.5)}
                  >
                    50%
                  </button>
                  <button
                    className="text-ink-500 hover:text-ink-900"
                    onClick={() => setPreset(1)}
                  >
                    MAX
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm border-t border-line pt-4">
              <Row k="Allocation" v={`~ ${fmtNum(expected, 4)} d${ticker}`} />
              <Row k="Your boost" v={`${boost.toFixed(2)}×`} tone="forest" />
              <Row k="Platform fee (2%)" v={fmtUSD(fee)} />
              <Row
                k="Yield while waiting"
                v={`+${fmtUSD(yieldEst)}`}
                tone="forest"
              />
              <Row k="Refund if unfilled" v="100%" />
            </div>

            {isConnected ? (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!validation.ok || pending}
                onClick={handleSubscribe}
                trailingIcon={
                  !pending && validation.ok ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : undefined
                }
              >
                {pending
                  ? "Signing…"
                  : validation.ok
                  ? "Subscribe · 20s"
                  : validation.hint}
              </Button>
            ) : (
              <ConnectButton size="md" variant="primary" className="w-full [&>div]:w-full [&_button]:w-full [&_button]:justify-center" label="Connect wallet to subscribe" />
            )}

            <div className="text-[11px] text-ink-500 leading-relaxed">
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
  tone?: "forest";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
        {k}
      </div>
      <div
        className={
          "text-xl font-mono tabular-nums mt-1 " +
          (tone === "forest" ? "text-forest-500" : "text-ink-900")
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
    <div className="card p-5">
      <Icon className="h-4 w-4 text-forest-500 mb-3" />
      <div className="text-sm font-semibold text-ink-900">{title}</div>
      <div className="text-xs text-ink-500 mt-1 leading-relaxed">{body}</div>
    </div>
  );
}
