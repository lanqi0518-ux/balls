import { Header } from "@/components/Header";
import { IPOCard } from "@/components/IPOCard";

// In production, populate from IPORegistry.getActiveIPOs() + RH REST APIs.
// For the scaffold, we render static seed data so the UI works out of the box.
const SEED_IPOS = [
  {
    ticker: "STRIPE",
    name: "Stripe Inc.",
    subscribedUSD: 2_300_000,
    targetUSD: 5_000_000,
    expectedPrice: 85,
    countdownSec: 3 * 86400 + 4 * 3600,
    boost: 2.5,
  },
  {
    ticker: "KLARNA",
    name: "Klarna Bank AB",
    subscribedUSD: 450_000,
    targetUSD: 3_000_000,
    expectedPrice: 32,
    countdownSec: 8 * 86400,
    boost: 2.5,
  },
  {
    ticker: "REDDIT",
    name: "Reddit Inc.",
    subscribedUSD: 1_100_000,
    targetUSD: 4_000_000,
    expectedPrice: 47,
    countdownSec: 12 * 86400,
    boost: 2.5,
  },
];

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <section className="mb-12 text-center">
          <h1 className="text-5xl font-bold tracking-tight">
            Subscribe to <span className="text-brand">real IPOs</span> on-chain.
          </h1>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            No broker. No KYC. In 20 seconds. Powered by Robinhood Chain, priced
            through the Rialto propAMM, boosted by your $IPO stake.
          </p>
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">🔥 Upcoming IPOs</h2>
            <a
              href="https://api.robinhood.com/rhj/assets"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-gray-400 hover:text-brand"
            >
              Data source: /rhj/assets ↗
            </a>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SEED_IPOS.map((ipo) => (
              <IPOCard key={ipo.ticker} {...ipo} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
