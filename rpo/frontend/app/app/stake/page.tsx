"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Button, LinkButton } from "@/components/ui/Button";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";
import { computeBoost, useDemoStore } from "@/lib/demoStore";
import { useTx } from "@/lib/useTx";
import { fmtUSD, fmtNum } from "@/lib/format";

export default function StakePage() {
  const { isConnected } = useAccount();
  const {
    balanceRPO,
    stakedRPO,
    totalStakedPool,
    stake,
    unstake,
  } = useDemoStore();
  const { pending, run } = useTx();

  const [mode, setMode] = useState<"stake" | "unstake">("stake");
  const [amountStr, setAmountStr] = useState("20000");
  const amount = Number(amountStr) || 0;

  const currentBoost = computeBoost(stakedRPO, totalStakedPool);
  const projectedBoost = useMemo(() => {
    if (mode === "stake") {
      return computeBoost(stakedRPO + amount, totalStakedPool + amount);
    }
    return computeBoost(
      Math.max(0, stakedRPO - amount),
      Math.max(0, totalStakedPool - amount)
    );
  }, [mode, amount, stakedRPO, totalStakedPool]);

  const share = stakedRPO / Math.max(1, totalStakedPool);

  const validation = useMemo(() => {
    if (!isConnected) return { ok: false, hint: "Connect wallet" };
    if (amount <= 0) return { ok: false, hint: "Enter an amount" };
    if (mode === "stake" && amount > balanceRPO)
      return {
        ok: false,
        hint: `Insufficient $RPO (have ${fmtNum(balanceRPO, 0)})`,
      };
    if (mode === "unstake" && amount > stakedRPO)
      return {
        ok: false,
        hint: `Only ${fmtNum(stakedRPO, 0)} staked`,
      };
    return { ok: true, hint: mode === "stake" ? "Stake" : "Unstake" };
  }, [isConnected, amount, mode, balanceRPO, stakedRPO]);

  const handleSubmit = () => {
    if (!validation.ok) return;
    if (mode === "stake") {
      run(() => stake(amount), {
        loading: `Simulating stake(${fmtNum(amount, 0)} $RPO) …`,
        success: `Simulated stake of ${fmtNum(amount, 0)} $RPO (preview)`,
      });
    } else {
      run(() => unstake(amount), {
        loading: `Simulating unstake(${fmtNum(amount, 0)} $RPO) …`,
        success: `Simulated unstake of ${fmtNum(amount, 0)} $RPO — 14d cooldown (preview)`,
      });
    }
  };

  const setPreset = (raw: number) => setAmountStr(String(raw));

  return (
    <div className="p-5 lg:p-10 max-w-5xl">
      <header className="mb-10">
        <div className="eyebrow mb-3">$RPO</div>
        <h1 className="font-display text-4xl lg:text-5xl text-ink-900">
          Stake to boost allocation.
        </h1>
        <p className="mt-4 text-ink-500 max-w-2xl">
          Locking $RPO multiplies your weight on every SubscriptionVault, up
          to 3×. The curve is{" "}
          <span className="font-mono text-forest-500 bg-forest-50 px-1.5 py-0.5 rounded">
            boost = 1 + 2·√share
          </span>{" "}
          — early stakers keep the advantage without letting whales monopolize
          allocations.
        </p>
      </header>

      {/* USDG-vs-$RPO clarifier — the single most-asked question */}
      <div className="card p-6 mb-10 grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-full bg-ink-900 text-white flex items-center justify-center text-xs font-bold">
              1
            </div>
            <div className="font-semibold text-ink-900">Pay with USDG</div>
          </div>
          <p className="text-sm text-ink-500 leading-relaxed">
            The actual money that buys the underlying Stock Token. Required to
            subscribe. Fully refundable if the IPO doesn&apos;t list on time.
          </p>
        </div>
        <div className="text-2xl text-ink-300 hidden md:block">+</div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-full bg-forest-500 text-white flex items-center justify-center text-xs font-bold">
              2
            </div>
            <div className="font-semibold text-ink-900">
              Stake $RPO for priority
            </div>
          </div>
          <p className="text-sm text-ink-500 leading-relaxed">
            Optional. Multiplies your subscription weight (1× → 3×), so if the
            IPO is oversubscribed you get a bigger cut of the fixed share pool.
          </p>
        </div>
        <div className="md:col-span-3 mt-2 pt-4 border-t border-line flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-500">
          <span>
            <span className="font-mono text-ink-900">1</span> USDG @{" "}
            <span className="font-mono text-ink-900">1.00×</span> → weight{" "}
            <span className="font-mono text-ink-900">1.00</span>
          </span>
          <span>
            <span className="font-mono text-ink-900">1</span> USDG @{" "}
            <span className="font-mono text-forest-500">2.00×</span> → weight{" "}
            <span className="font-mono text-forest-500">2.00</span>
          </span>
          <span className="ml-auto">
            <a href="/economics#02" className="text-forest-500 hover:underline">
              Full mechanics table →
            </a>
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="card-floating p-8">
            {/* Mode switcher */}
            <div className="grid grid-cols-2 rounded-full border border-line bg-paper-100 p-1 mb-6">
              {(["stake", "unstake"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={
                    "text-sm py-2 rounded-full transition-colors " +
                    (mode === m
                      ? "bg-white text-ink-900 shadow-soft"
                      : "text-ink-500 hover:text-ink-900")
                  }
                >
                  {m === "stake" ? "Stake" : "Unstake"}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-[0.18em] text-ink-500">
                Amount
              </div>
              <div className="text-xs text-ink-500">
                {mode === "stake" ? "Balance" : "Staked"}:{" "}
                <span className="font-mono text-ink-900">
                  {fmtNum(mode === "stake" ? balanceRPO : stakedRPO, 0)} $RPO
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-paper-100 border border-line p-4 flex items-center gap-3">
              <input
                className="bg-transparent text-3xl font-mono text-ink-900 outline-none flex-1 tabular-nums placeholder:text-ink-400"
                value={amountStr}
                onChange={(e) =>
                  setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))
                }
                inputMode="decimal"
              />
              <div className="text-sm text-ink-500">$RPO</div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {(mode === "stake"
                ? [10_000, 25_000, 50_000, 100_000]
                : [
                    Math.round(stakedRPO * 0.25),
                    Math.round(stakedRPO * 0.5),
                    Math.round(stakedRPO * 0.75),
                    stakedRPO,
                  ]).map((v, i) => (
                <button
                  key={i}
                  onClick={() => setPreset(v)}
                  className="rounded-lg border border-line hover:border-ink-900 hover:bg-paper-100 text-sm text-ink-500 hover:text-ink-900 py-2 transition-colors"
                >
                  {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-2 text-sm border-t border-line pt-4">
              <Row k="Lock period" v="14 days minimum" />
              <Row
                k={
                  mode === "stake" ? "Projected boost" : "Boost after unstake"
                }
                v={`${projectedBoost.toFixed(2)}×`}
                tone="forest"
              />
              <Row
                k="Share of pool"
                v={`${(share * 100).toFixed(3)}% → ${(
                  (mode === "stake"
                    ? (stakedRPO + amount) / (totalStakedPool + amount)
                    : Math.max(0, stakedRPO - amount) /
                      Math.max(1, totalStakedPool - amount)) * 100
                ).toFixed(3)}%`}
              />
              <Row
                k="Boost change"
                v={`${projectedBoost >= currentBoost ? "+" : ""}${(
                  projectedBoost - currentBoost
                ).toFixed(2)}×`}
                tone={projectedBoost >= currentBoost ? "forest" : "rose"}
              />
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-ink-500 mb-2">
                <span>1×</span>
                <span>3× cap</span>
              </div>
              <div className="h-1.5 rounded-full bg-paper-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-forest-500 to-peach-500 transition-all duration-500"
                  style={{
                    width: `${((projectedBoost - 1) / 2) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              {isConnected ? (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={!validation.ok || pending}
                  onClick={handleSubmit}
                >
                  {pending
                    ? "Simulating…"
                    : validation.ok
                    ? mode === "stake"
                      ? "Preview stake (demo)"
                      : "Preview unstake (demo)"
                    : validation.hint}
                </Button>
              ) : (
                <ConnectButton
                  size="md"
                  variant="primary"
                  className="w-full [&>div]:w-full [&_button]:w-full [&_button]:justify-center"
                  label="Connect wallet"
                />
              )}
              <LinkButton
                href="https://pons.dev"
                external
                variant="outline"
                size="lg"
                trailingIcon={<ArrowUpRight className="h-4 w-4" />}
              >
                Buy
              </LinkButton>
            </div>

            <div className="mt-6 text-xs text-ink-500 leading-relaxed">
              Unstake starts a 14-day cooldown. 80% of every 2% platform fee
              is spent on open-market $RPO buybacks on Pons, streamed back to
              this contract as protocol accrual.
            </div>
          </div>
        </div>

        <aside className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs uppercase tracking-[0.18em] text-ink-500">
                Your stake
              </div>
              <span className="text-[10px] uppercase tracking-[0.14em] text-peach-600 bg-peach-50 border border-peach-200 rounded-full px-2 py-0.5 font-mono">
                simulated
              </span>
            </div>
            {isConnected ? (
              <div className="space-y-3 text-sm">
                <Row k="Staked" v={`${fmtNum(stakedRPO, 0)} $RPO`} />
                <Row
                  k="Current boost"
                  v={`${currentBoost.toFixed(2)}×`}
                  tone="forest"
                />
                <Row
                  k="Wallet balance"
                  v={`${fmtNum(balanceRPO, 0)} $RPO`}
                />
                <p className="text-[11px] text-ink-500 leading-snug pt-2 border-t border-line mt-3">
                  These numbers are a local browser preview — no on-chain
                  balance is read from your wallet. Real $RPO ships with
                  mainnet ({" "}
                  <a href="/roadmap" className="text-forest-500 hover:underline">
                    Q4 2026
                  </a>
                  ).
                </p>
              </div>
            ) : (
              <div className="text-sm text-ink-500 leading-relaxed">
                Connect a wallet to preview the stake UX. All numbers are
                simulated in your browser — no real $RPO is read or moved.
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-ink-500 mb-4">
              Pool
            </div>
            <div className="space-y-3 text-sm">
              <Row
                k="Total staked"
                v={`${(totalStakedPool / 1000).toFixed(0)}k`}
              />
              <Row k="% of supply" v="39%" />
              <Row k="24h buybacks" v="$4.3k" tone="forest" />
              <Row k="Cumulative buybacks" v={fmtUSD(168_000)} tone="forest" />
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="forest">$RPO</Badge>
              <Badge>Pons LP</Badge>
              <Badge>SPY-pair</Badge>
            </div>
            <div className="text-sm text-ink-500 leading-relaxed">
              $RPO launched fair on{" "}
              <a
                href="https://pons.dev"
                target="_blank"
                rel="noreferrer"
                className="text-forest-500 hover:underline"
              >
                Pons
              </a>{" "}
              paired against SPY. No team unlock cliff, no VC allocation,
              1B fixed supply.
            </div>
          </div>
        </aside>
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
  tone?: "forest" | "rose";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{k}</span>
      <span
        className={
          "font-mono tabular-nums " +
          (tone === "forest"
            ? "text-forest-500 font-semibold"
            : tone === "rose"
            ? "text-rose-600"
            : "text-ink-900")
        }
      >
        {v}
      </span>
    </div>
  );
}
