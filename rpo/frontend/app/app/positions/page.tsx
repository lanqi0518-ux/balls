"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { PendingDeploymentPanel } from "@/components/app/NetworkStatus";
import { ArrowUpRight, Wallet } from "@/components/ui/Icons";
import {
  useBoost,
  useRpoBalance,
  useStake,
  useTotalStaked,
  useUsdgBalance,
} from "@/lib/onchain/reads";
import {
  OnchainPosition,
  useOnchainPositions,
} from "@/lib/onchain/positions";
import {
  useCancelSubscription,
  useClaimAllocation,
} from "@/lib/onchain/writes";
import {
  boostToNumber,
  RPO_DECIMALS,
  toNumber,
  USDG_DECIMALS,
} from "@/lib/onchain/units";
import { useProtocol } from "@/lib/onchain/protocol";
import { fmtNum, fmtUSD } from "@/lib/format";

export default function PositionsPage() {
  const { isConnected } = useAccount();
  const proto = useProtocol();

  const usdgBalance = useUsdgBalance();
  const rpoBalance = useRpoBalance();
  const stake = useStake();
  const totalStaked = useTotalStaked();
  const boost = useBoost();
  const positions = useOnchainPositions();

  const balanceUSDG = toNumber(usdgBalance.data, USDG_DECIMALS);
  const balanceRPO = toNumber(rpoBalance.data, RPO_DECIMALS);
  const stakedRPO = toNumber(stake.data.amount, RPO_DECIMALS);
  const totalStakedPool = toNumber(totalStaked.data, RPO_DECIMALS);
  const currentBoost = boostToNumber(boost.data);

  const activeValue = positions.data.reduce(
    (a, p) => a + toNumber(p.deposits, USDG_DECIMALS),
    0
  );

  return (
    <div className="p-5 lg:p-10 max-w-6xl">
      <header className="mb-10 flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="eyebrow mb-3">Portfolio</div>
          <h1 className="font-display text-4xl lg:text-5xl text-ink-900">
            Your positions
          </h1>
        </div>
      </header>

      {!proto.isLive ? (
        <PendingDeploymentPanel
          title="Positions · pending deployment"
          hint="Once contracts are deployed on the active chain, this page reads real balances, stakes, and vault subscriptions directly from the IPORegistry — nothing is stored in your browser."
        />
      ) : !isConnected ? (
        <div className="card p-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-paper-100 border border-line flex items-center justify-center mx-auto mb-6">
            <Wallet className="h-6 w-6 text-ink-500" />
          </div>
          <div className="text-ink-900 text-lg font-medium mb-2">
            Wallet not connected
          </div>
          <div className="text-ink-500 text-sm mb-6">
            Connect a wallet to see your active subscriptions, stake, and
            Stock-Token holdings — all read directly from{" "}
            <span className="font-mono">{proto.chainName}</span>.
          </div>
          <div className="inline-flex">
            <ConnectButton size="md" variant="primary" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-4 mb-10">
            <SummaryCard
              label="USDG"
              value={fmtUSD(balanceUSDG)}
              hint="Wallet balance"
            />
            <SummaryCard
              label="$RPO"
              value={fmtNum(balanceRPO, 0)}
              hint={`${fmtNum(stakedRPO, 0)} staked`}
            />
            <SummaryCard
              label="Active subs"
              value={fmtUSD(activeValue)}
              hint={`${positions.data.length} vault${
                positions.data.length === 1 ? "" : "s"
              }`}
            />
            <SummaryCard
              label="Boost"
              value={`${currentBoost.toFixed(2)}×`}
              tone="forest"
              hint={
                totalStakedPool > 0
                  ? `${((stakedRPO / totalStakedPool) * 100).toFixed(3)}% of pool`
                  : "Stake to earn boost"
              }
            />
          </div>

          <section className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <Badge variant="forest" dot>
                Onchain · {positions.data.length}
              </Badge>
              <div className="text-xs text-ink-500">
                Read live from every SubscriptionVault you&apos;ve deposited
                into.
              </div>
            </div>
            {positions.data.length === 0 ? (
              <div className="card p-8 text-center">
                <div className="text-sm text-ink-500 mb-4">
                  No active subscriptions yet.
                </div>
                <Link href="/app" className="btn-primary text-sm">
                  Browse IPO calendar
                </Link>
              </div>
            ) : (
              <div className="card divide-y divide-line">
                {positions.data.map((p) => (
                  <PositionRow
                    key={p.ipo.vault}
                    p={p}
                    onChanged={() => positions.refetch()}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PositionRow({
  p,
  onChanged,
}: {
  p: OnchainPosition;
  onChanged: () => void;
}) {
  const cancel = useCancelSubscription(p.ipo.vault);
  const claim = useClaimAllocation(p.ipo.vault);

  const depositUSD = toNumber(p.deposits, USDG_DECIMALS);
  const now = Math.floor(Date.now() / 1000);
  const remaining = Math.max(0, Number(p.ipo.subscriptionDeadline) - now);

  return (
    <div className="p-5 flex items-center justify-between hover:bg-paper-100 transition-colors">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 flex items-center justify-center text-sm font-semibold text-white">
          {p.ipo.ticker.slice(0, 2)}
        </div>
        <div>
          <div className="text-ink-900 font-semibold">{p.ipo.ticker}</div>
          <div className="text-xs text-ink-500">
            {p.ipo.name} · deposit {fmtUSD(depositUSD)} · weight{" "}
            {p.weight.toString()}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 text-right">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
            State
          </div>
          <div className="font-mono text-sm text-ink-900 mt-1">
            {p.fulfilled
              ? p.claimed
                ? "Claimed"
                : "Ready to claim"
              : remaining > 0
              ? "Subscribing"
              : "Awaiting fulfillment"}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
            Vault
          </div>
          <div className="font-mono text-xs text-ink-500 mt-1">
            {p.ipo.vault.slice(0, 8)}…
          </div>
        </div>
      </div>
      <div className="flex gap-2 ml-4">
        {p.fulfilled && !p.claimed && (
          <Button
            variant="primary"
            size="sm"
            disabled={claim.pending}
            onClick={() => claim.run({ onConfirmed: onChanged })}
          >
            {claim.pending ? "…" : "Claim"}
          </Button>
        )}
        {!p.fulfilled && remaining > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={cancel.pending}
            onClick={() => cancel.run({ onConfirmed: onChanged })}
          >
            {cancel.pending ? "…" : "Cancel"}
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "forest" | "rose";
}) {
  return (
    <div className="card p-6">
      <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500">
        {label}
      </div>
      <div
        className={
          "font-display text-3xl tabular-nums mt-3 " +
          (tone === "forest"
            ? "text-forest-500"
            : tone === "rose"
            ? "text-rose-600"
            : "text-ink-900")
        }
      >
        {value}
      </div>
      {hint && <div className="text-xs text-ink-500 mt-2">{hint}</div>}
    </div>
  );
}
