"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { useAccount } from "wagmi";

export default function SubscribePage({ params }: { params: { ticker: string } }) {
  const { ticker } = params;
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState("500");
  const [payToken, setPayToken] = useState("USDG-RH");

  const expected = amount ? (parseFloat(amount) / 85).toFixed(2) : "0";
  const fee = amount ? (parseFloat(amount) * 0.02).toFixed(2) : "0";

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <a href="/" className="text-sm text-gray-400 hover:text-brand mb-6 inline-block">
          ← Back
        </a>
        <div className="card p-8">
          <h1 className="text-3xl font-bold">Subscribe to {ticker.toUpperCase()} IPO</h1>
          <p className="text-gray-400 mt-2">Expected launch: in 3 days 4 hours</p>

          <div className="mt-8 space-y-6">
            <div>
              <label className="text-sm text-gray-400 block mb-2">
                Amount to subscribe
              </label>
              <div className="flex gap-3">
                <input
                  className="flex-1 bg-chain-bg border border-chain-border rounded-xl px-4 py-3 text-xl font-mono"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                />
                <select
                  className="bg-chain-bg border border-chain-border rounded-xl px-4"
                  value={payToken}
                  onChange={(e) => setPayToken(e.target.value)}
                >
                  <option value="USDG-RH">USDG (Robinhood Chain)</option>
                  <option value="USDC-BASE">USDC (Base via LiFi)</option>
                  <option value="USDC-ARB">USDC (Arbitrum via LiFi)</option>
                  <option value="ETH-ETH">ETH (Ethereum via LiFi)</option>
                </select>
              </div>
            </div>

            <div className="border-t border-chain-border pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Your allocation</span>
                <span className="font-mono">~ {expected} d{ticker.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Boost</span>
                <span className="text-brand">2.5x (via staked $IPO)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Platform fee (2%)</span>
                <span className="font-mono">${fee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Yield while waiting</span>
                <span className="text-brand">+$1.20 (Morpho USDG @ ~4% APY)</span>
              </div>
            </div>

            <div className="text-xs text-gray-500 border-t border-chain-border pt-4">
              Refund policy: Full refund if the IPO doesn&apos;t launch by the fulfillment deadline.
              Stock Tokens are not available to U.S. persons per RHJ terms.
            </div>

            <button
              className="btn-primary w-full py-4 text-lg"
              disabled={!isConnected}
            >
              {isConnected ? "Subscribe — 20 seconds" : "Connect wallet to subscribe"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
