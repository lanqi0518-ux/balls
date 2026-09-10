"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { PendingDeploymentPanel } from "@/components/app/NetworkStatus";
import {
  Check,
  ArrowUpRight,
  Shield,
  Lock,
  Bolt,
} from "@/components/ui/Icons";
import { findIPO } from "@/lib/catalog";
import { CONTRACTS, isDeployed } from "@/lib/chain";
import { useProtocol } from "@/lib/onchain/protocol";
import {
  useActiveIPOs,
  useAllowance,
  useBoost,
  useUsdgBalance,
  useVaultPosition,
} from "@/lib/onchain/reads";
import {
  useCancelSubscription,
  useErc20Approve,
  useSubscribeVault,
} from "@/lib/onchain/writes";
import {
  boostToNumber,
  toNumber,
  toUnits,
  USDG_DECIMALS,
} from "@/lib/onchain/units";
import { useOffsetCountdown } from "@/lib/useOffsetCountdown";
import { fmtUSD, fmtNum, fmtCountdown, pct } from "@/lib/format";

export default function SubscribePage({
  params,
}: {
  params: { ticker: string };
}) {
  const seed = findIPO(params.ticker);
  if (!seed) notFound();

  const ticker = seed.ticker;
  const { isConnected } = useAccount();
  const proto = useProtocol();

  // Look up the *real* vault address for this ticker from the onchain
  // registry. When the registry isn't deployed the array is empty and
  // we fall back to the catalog preview (no writes possible).
  const active = useActiveIPOs();
  const onchainVault = useMemo(() => {
    return active.data.find(
      (v) => v.ticker.toLowerCase() === ticker.toLowerCase()
    );
  }, [active.data, ticker]);
  const vault = onchainVault?.vault;

  const usdgBalance = useUsdgBalance();
  const boost = useBoost();
  const position = useVaultPosition(vault);
  const allowance = useAllowance(CONTRACTS.usdg, vault);

  const approve = useErc20Approve(CONTRACTS.usdg, vault ?? "0x0000000000000000000000000000000000000000");
  const subscribe = useSubscribeVault(vault);
  const cancel = useCancelSubscription(vault);

  const balanceUSDG = toNumber(usdgBalance.data, USDG_DECIMALS);
  const userBoost = boostToNumber(boost.data);
  const totalSubscribedOnchain = toNumber(position.data.totalUSDG, USDG_DECIMALS);
  const userDeposit = toNumber(position.data.deposits, USDG_DECIMALS);

  // Countdown: prefer real onchain deadline; fall back to catalog offset.
  const remaining = useSubscriptionCountdown(
    onchainVault?.subscriptionDeadline,
    seed.launchOffsetSec
  );

  // Total subscribed = onchain when live, seed preview otherwise.
  const totalSubscribed = onchainVault
    ? totalSubscribedOnchain
    : seed.seedSubscribedUSD;
  const progress = pct(totalSubscribed, seed.targetUSD);

  const [amountStr, setAmountStr] = useState("500");
  const [payToken, setPayToken] = useState<
    "USDG" | "USDC-BASE" | "USDC-ARB" | "ETH"
  >("USDG");
  const amount = Number(amountStr) || 0;
  const amountUnits = toUnits(amountStr, USDG_DECIMALS);

  const expected = amount / seed.expectedPrice;
  const fee = amount * 0.02;
  const yieldEst = ((amount * 0.04) / 365) * Math.max(1, remaining / 86400);

  const canWrite = !!vault && !subscribe.notLive && payToken === "USDG";
  const needsApproval =
    isConnected &&
    canWrite &&
    amountUnits > 0n &&
    allowance.data < amountUnits;

  const validation = useMemo(() => {
    if (!isConnected)
      return { ok: false, hint: "Connect wallet to subscribe" };
    if (!proto.isLive)
      return { ok: false, hint: "Not deployed on this chain yet" };
    if (!vault)
      return { ok: false, hint: "Vault not open yet" };
    if (amount <= 0) return { ok: false, hint: "Enter an amount" };
    if (payToken !== "USDG")
      return { ok: false, hint: "Bridging (coming soon) — pay in USDG" };
    if (amount > balanceUSDG)
      return {
        ok: false,
        hint: `Insufficient USDG (have ${fmtUSD(balanceUSDG)})`,
      };
    if (remaining <= 0)
      return { ok: false, hint: "Subscription window closed" };
    if (needsApproval) return { ok: true, hint: "Approve USDG" };
    return { ok: true, hint: `Subscribe ${fmtUSD(amount)}` };
  }, [
    amount,
    balanceUSDG,
    isConnected,
    needsApproval,
    payToken,
    proto.isLive,
    remaining,
    vault,
  ]);

  const busy = approve.pending || subscribe.pending || cancel.pending;

  async function handleSubscribe() {
    if (!validation.ok || busy) return;
    if (needsApproval) {
      await approve.run(amountUnits, {
        onConfirmed: () => allowance.refetch(),
      });
      return;
    }
    await subscribe.run(amountUnits, {
      onConfirmed: () => {
        usdgBalance.refetch();
        position.refetch();
        active.refetch();
        setAmountStr("0");
      },
    });
  }

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
                variant={seed.status === "Subscribing" ? "forest" : "default"}
                dot={seed.status === "Subscribing"}
                className="ml-auto"
              >
                {seed.status}
              </Badge>
            </div>

            <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
              <Stat k="Expected price" v={fmtUSD(seed.expectedPrice)} />
              <Stat
                k="Subscribed"
                v={fmtUSD(totalSubscribed, { compact: true })}
              />
              <Stat k="Target" v={fmtUSD(seed.targetUSD, { compact: true })} />
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

            {vault && (
              <div className="mt-6 pt-6 border-t border-line grid grid-cols-2 gap-6 text-xs">
                <div>
                  <div className="uppercase tracking-[0.14em] text-ink-500 mb-1">
                    Vault
                  </div>
                  <a
                    href={`${proto.contracts.registry === vault ? "#" : "#"}`}
                    className="font-mono text-ink-900 truncate block"
                    title={vault}
                  >
                    {vault.slice(0, 10)}…{vault.slice(-6)}
                  </a>
                </div>
                <div>
                  <div className="uppercase tracking-[0.14em] text-ink-500 mb-1">
                    Your deposit
                  </div>
                  <div className="font-mono text-ink-900">
                    {fmtUSD(userDeposit)}
                  </div>
                </div>
              </div>
            )}
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
          {!proto.isLive ? (
            <div className="sticky top-24">
              <PendingDeploymentPanel
                title="Subscribe · pending vault deployment"
                hint="Every SubscriptionVault is deployed permissionlessly by AssetDiscovery. Once the discovery contract is live on this chain, this vault will open automatically and this panel will replace itself with a real subscribe button — no rebuild required."
              />
            </div>
          ) : (
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
                    onChange={(e) =>
                      setPayToken(e.target.value as typeof payToken)
                    }
                  >
                    <option value="USDG">USDG</option>
                    <option value="USDC-BASE">USDC · Base (soon)</option>
                    <option value="USDC-ARB">USDC · Arb (soon)</option>
                    <option value="ETH">ETH · Mainnet (soon)</option>
                  </select>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-ink-500">
                    Balance:{" "}
                    <span className="font-mono">{fmtUSD(balanceUSDG)}</span>
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
                <Row
                  k="Allocation"
                  v={`~ ${fmtNum(expected, 4)} d${ticker}`}
                />
                <Row
                  k="Your boost"
                  v={`${userBoost.toFixed(2)}×`}
                  tone="forest"
                />
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
                  disabled={!validation.ok || busy}
                  onClick={handleSubscribe}
                  trailingIcon={
                    !busy && validation.ok ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : undefined
                  }
                >
                  {busy
                    ? approve.pending
                      ? "Approving USDG…"
                      : "Subscribing…"
                    : validation.hint}
                </Button>
              ) : (
                <ConnectButton
                  size="md"
                  variant="primary"
                  className="w-full [&>div]:w-full [&_button]:w-full [&_button]:justify-center"
                  label="Connect wallet to subscribe"
                />
              )}

              {userDeposit > 0 && (
                <Button
                  variant="outline"
                  size="md"
                  fullWidth
                  disabled={busy || remaining <= 0}
                  onClick={() =>
                    cancel.run({
                      onConfirmed: () => {
                        usdgBalance.refetch();
                        position.refetch();
                      },
                    })
                  }
                >
                  {cancel.pending
                    ? "Cancelling…"
                    : `Cancel & refund ${fmtUSD(userDeposit)}`}
                </Button>
              )}

              <div className="text-[11px] text-ink-500 leading-relaxed">
                By subscribing you deposit USDG into a per-IPO CREATE2 vault.
                You can cancel any time until the subscription deadline. Full
                refund if the IPO doesn&apos;t launch by the fulfillment
                deadline.
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * Prefer the real onchain subscription deadline; fall back to the
 * catalog offset when the vault isn't onchain yet. Delivers the same
 * countdown to both cases.
 */
function useSubscriptionCountdown(
  onchainDeadline: bigint | undefined,
  fallbackOffsetSec: number
): number {
  const nowMs = useOffsetCountdown(fallbackOffsetSec);
  if (onchainDeadline && onchainDeadline > 0n) {
    const secs = Number(onchainDeadline) - Math.floor(Date.now() / 1000);
    return Math.max(0, secs);
  }
  return Math.max(0, nowMs);
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
