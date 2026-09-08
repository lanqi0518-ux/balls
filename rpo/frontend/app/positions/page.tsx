"use client";

import { Header } from "@/components/Header";
import { useAccount } from "wagmi";

const HOLDINGS = [
  { ticker: "dCORZ", amount: 120.5, valueUSD: 2412, changePct: 18 },
  { ticker: "dRDDT", amount: 34.2, valueUSD: 876, changePct: -4 },
];

const ACTIVE = [
  { ticker: "STRIPE", amountUSDG: 500, launchIn: "3d 4h", expected: 5.88 },
];

export default function PositionsPage() {
  const { isConnected } = useAccount();
  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Your Positions</h1>

        {!isConnected && (
          <div className="card p-8 text-center text-gray-400">
            Connect your wallet to see your positions.
          </div>
        )}

        {isConnected && (
          <>
            <section className="mb-10">
              <h2 className="text-xl font-semibold mb-4">🟢 Active Subscriptions</h2>
              <div className="card divide-y divide-chain-border">
                {ACTIVE.map((row) => (
                  <div key={row.ticker} className="p-6 flex items-center justify-between">
                    <div>
                      <div className="font-bold">{row.ticker}</div>
                      <div className="text-sm text-gray-400">
                        ${row.amountUSDG} subscribed · launch in {row.launchIn}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">Expected</div>
                      <div className="font-mono">{row.expected} d{row.ticker}</div>
                    </div>
                    <button className="btn-outline ml-4 text-sm">Cancel</button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">💎 Holdings</h2>
              <div className="card divide-y divide-chain-border">
                {HOLDINGS.map((h) => (
                  <div key={h.ticker} className="p-6 flex items-center justify-between">
                    <div>
                      <div className="font-bold">{h.ticker}</div>
                      <div className="text-sm text-gray-400">{h.amount} tokens</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono">${h.valueUSD.toLocaleString()}</div>
                      <div
                        className={`text-sm font-mono ${
                          h.changePct >= 0 ? "text-brand" : "text-red-400"
                        }`}
                      >
                        {h.changePct >= 0 ? "+" : ""}
                        {h.changePct}%
                      </div>
                    </div>
                    <div className="ml-4 flex gap-2">
                      <button className="btn-outline text-sm">Sell</button>
                      <button className="btn-outline text-sm">Loop</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
