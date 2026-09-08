"use client";

import { useState } from "react";
import { Header } from "@/components/Header";

function computeBoost(share: number): number {
  const s = Math.min(1, Math.max(0, share));
  const boost = 1 + 2 * Math.sqrt(s);
  return Math.min(3, boost);
}

export default function StakePage() {
  const [amount, setAmount] = useState("20000");
  // Placeholder: pretend total staked is 500,000 $RPO.
  const totalStaked = 500_000;
  const share = amount ? parseFloat(amount) / (totalStaked + parseFloat(amount)) : 0;
  const boost = computeBoost(share);

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Stake $RPO</h1>
        <p className="text-gray-400 mb-8">
          Locking $RPO boosts your IPO allocation on every SubscriptionVault (up to 3x).
        </p>

        <div className="card p-8 space-y-6">
          <div>
            <label className="text-sm text-gray-400 block mb-2">Stake amount</label>
            <input
              className="w-full bg-chain-bg border border-chain-border rounded-xl px-4 py-3 text-xl font-mono"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="20000"
            />
          </div>

          <div className="border-t border-chain-border pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Lock period</span>
              <span className="font-mono">14 days (min)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Your projected boost</span>
              <span className="text-brand font-mono">{boost.toFixed(2)}x</span>
            </div>
            <div className="w-full h-2 bg-chain-border rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${(boost / 3) * 100}%` }}
              />
            </div>
          </div>

          <div className="border-t border-chain-border pt-4 text-xs text-gray-500">
            Every subscription contributes 80% of its 2% platform fee to open-market
            $RPO buybacks. Stake &amp; earn from both allocation boost and long-term
            protocol accrual.
          </div>

          <div className="flex gap-3">
            <button className="btn-primary flex-1 py-3">Stake</button>
            <button className="btn-outline flex-1 py-3">Buy $RPO on Pons ↗</button>
          </div>
        </div>
      </main>
    </>
  );
}
