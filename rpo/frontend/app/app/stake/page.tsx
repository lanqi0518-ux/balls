"use client";

import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";

function computeBoost(share: number): number {
  const s = Math.min(1, Math.max(0, share));
  const boost = 1 + 2 * Math.sqrt(s);
  return Math.min(3, boost);
}

const TOTAL_STAKED = 1_700_000;

export default function StakePage() {
  const [amount, setAmount] = useState("20000");
  const stake = parseFloat(amount) || 0;
  const share = stake / (TOTAL_STAKED + stake);
  const boost = computeBoost(share);

  return (
    <div className="p-5 lg:p-10 max-w-5xl">
      <header className="mb-10">
        <div className="eyebrow mb-3">$RPO</div>
        <h1 className="font-display text-4xl lg:text-5xl text-fg">
          Stake to boost allocation.
        </h1>
        <p className="mt-4 text-fg-muted max-w-2xl">
          Locking $RPO multiplies your weight on every SubscriptionVault, up
          to 3×. The curve is <span className="font-mono text-mint-400">boost = 1 + 2·√share</span>{" "}
          — early stakers keep the advantage without letting whales monopolize
          allocations.
        </p>
      </header>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="card-elevated p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs uppercase tracking-[0.14em] text-fg-dim">
                Stake amount
              </div>
              <div className="text-xs text-fg-dim">
                Balance: <span className="font-mono">— $RPO</span>
              </div>
            </div>

            <div className="rounded-xl bg-ink-900 border border-line p-4 flex items-center gap-3">
              <input
                className="bg-transparent text-3xl font-mono text-fg outline-none flex-1 tabular-nums"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                }
                inputMode="decimal"
              />
              <div className="text-sm text-fg-muted">$RPO</div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {["10k", "25k", "50k", "100k"].map((preset) => {
                const raw = preset.replace("k", "000");
                return (
                  <button
                    key={preset}
                    onClick={() => setAmount(raw)}
                    className="rounded-lg border border-line hover:border-mint-500/50 hover:text-mint-400 text-sm text-fg-muted py-2 transition-colors"
                  >
                    {preset}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 space-y-2 text-sm border-t border-line pt-4">
              <Row k="Lock period" v="14 days minimum" />
              <Row
                k="Your projected boost"
                v={`${boost.toFixed(2)}×`}
                tone="mint"
              />
              <Row k="Share of pool" v={`${(share * 100).toFixed(3)}%`} />
              <Row k="Est. next-IPO alloc bump" v={`+${((boost - 1) * 100).toFixed(0)}%`} tone="mint" />
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-fg-muted mb-2">
                <span>1×</span>
                <span>3× cap</span>
              </div>
              <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden">
                <div
                  className="h-full bg-mint-gradient transition-all duration-300"
                  style={{ width: `${((boost - 1) / 2) * 100}%` }}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="primary" size="lg" fullWidth>
                Stake $RPO
              </Button>
              <LinkButton
                href="https://pons.dev"
                external
                variant="outline"
                size="lg"
                trailingIcon={<ArrowUpRight className="h-4 w-4" />}
              >
                Buy $RPO
              </LinkButton>
            </div>

            <div className="mt-6 text-xs text-fg-dim leading-relaxed">
              Unstake takes 14 days to cool down. 80% of every 2% platform fee
              is spent on open-market $RPO buybacks on Pons, streamed back to
              this contract as protocol accrual.
            </div>
          </div>
        </div>

        <aside className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.14em] text-fg-dim mb-4">
              Pool
            </div>
            <div className="space-y-3 text-sm">
              <Row k="Total staked" v={`${(TOTAL_STAKED / 1000).toFixed(0)}k`} />
              <Row k="% of supply" v="39%" />
              <Row k="24h buybacks" v="$4.3k" tone="mint" />
              <Row k="Cumulative buybacks" v="$168k" tone="mint" />
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="mint">$RPO</Badge>
              <Badge>Pons LP</Badge>
              <Badge>SPY-pair</Badge>
            </div>
            <div className="text-sm text-fg-muted leading-relaxed">
              $RPO launched fair on{" "}
              <a
                href="https://pons.dev"
                target="_blank"
                rel="noreferrer"
                className="text-mint-400 hover:underline"
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
  tone?: "mint";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg-muted">{k}</span>
      <span
        className={
          tone === "mint"
            ? "text-mint-400 font-mono tabular-nums"
            : "text-fg font-mono tabular-nums"
        }
      >
        {v}
      </span>
    </div>
  );
}
