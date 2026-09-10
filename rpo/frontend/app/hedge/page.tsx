import type { Metadata } from "next";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Section, SectionHeader } from "@/components/ui/Section";
import { PrimitiveDeployBanner } from "@/components/hoodipo/PrimitiveDeployBanner";
import { HedgePanel } from "@/components/hoodipo/HedgePanel";
import { LockupCalendar } from "@/components/hoodipo/LockupCalendar";
import { getBuyableRecentIpos } from "@/lib/ipos/recent";
import { CONTRACTS } from "@/lib/chain";
import { Check } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "Lockup event hedging · LockupHedgeVault",
  description:
    "HOODIPO's primitive 05. Any d-TICKER holder can deposit their position, arm a Chainlink-strike stop-loss, and let any keeper execute the swap the moment the feed prints below strike. Composable on-chain lockup insurance.",
};

const INVARIANTS = [
  "Owner-only disarm and withdraw. Keepers can never move funds when the position is not armed.",
  "Trigger reverts unless the Chainlink feed's latest answer is ≤ strike. Off-strike triggers are impossible.",
  "Owner can call disarm() at any time; the position immediately returns to unarmed state and can be withdrawn to owner.",
  "Slippage on the trigger swap is enforced by minAmountOut passed by the keeper — but the keeper's own bounty is a % of received USDG, aligning incentives against under-fills.",
  "Per-token feed registration is first-writer-wins; nobody can rewrite the strike oracle after arming.",
];

export default function HedgePage() {
  const recent = getBuyableRecentIpos().slice(0, 8);

  return (
    <MarketingShell>
      <PageHero
        eyebrow="Primitive 05 · LockupHedgeVault"
        title={
          <>
            Hedge the{" "}
            <span className="italic text-forest-500">180-day cliff</span> —
            without giving up custody.
          </>
        }
        description="Every recent-IPO Robinhood Stock Token — CRCL, FIG, CRWV, BULL — carries the same 180-day insider lockup as its underlying. When the cliff lifts, insider unlock volume typically dumps 10-30% of float. HOODIPO's LockupHedgeVault lets any holder pre-authorise a Chainlink-strike stop-loss; any keeper triggers the swap when the feed prints below strike, taking a bounty out of the trade."
      />

      <Section>
        <PrimitiveDeployBanner
          primitive="LockupHedgeVault · Primitive 05"
          address={CONTRACTS.lockupHedge}
          githubPath="https://github.com/lanqi0518-ux/hoodipo/blob/main/rpo/contracts/src/hoodipo/LockupHedgeVault.sol"
        />

        <div className="mt-10 grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <HedgePanel />
          </div>
          <div className="lg:col-span-2 card-soft p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono mb-3">
              Lifecycle
            </div>
            <ol className="space-y-3 text-sm text-ink-500 leading-relaxed">
              <li>
                <span className="text-ink-900 font-semibold">01. open(token, amount, lockupExpiry)</span> — Deposit d-TICKER; you keep custody
                (vault only holds it until you disarm).
              </li>
              <li>
                <span className="text-ink-900 font-semibold">02. armStopLoss(id, strikeUsd8, maxSlippageBps)</span> — Set your
                Chainlink-strike floor. Requires the token's feed to be
                registered on-chain first.
              </li>
              <li>
                <span className="text-ink-900 font-semibold">03. trigger(id, router, swapData, minOut)</span> — Anyone can call this once
                the feed prints ≤ strike. The vault swaps for USDG and
                pays owner minus (2% platform fee + 2% keeper bounty).
              </li>
              <li>
                <span className="text-ink-900 font-semibold">04. disarm() + withdraw()</span> — Owner-only exit. If the strike was
                never hit, nothing was moved; you get 100% of your
                d-TICKER back.
              </li>
            </ol>
          </div>
        </div>
      </Section>

      <Section className="border-t border-line bg-paper-100">
        <SectionHeader
          eyebrow="Lockup calendar"
          title="Real-world insider unlock dates on Robinhood Chain tickers."
          description="Each row is derived from the underlying's S-1/8-K prospectus. Registering the expiry on-chain makes it a composable primitive for downstream insurance pools."
        />
        <LockupCalendar ipos={recent} />
      </Section>

      <Section>
        <SectionHeader
          eyebrow="Five invariants"
          title="What the vault guarantees."
        />
        <div className="grid md:grid-cols-2 gap-4">
          {INVARIANTS.map((line) => (
            <div key={line} className="card p-5 flex items-start gap-3">
              <Check className="h-4 w-4 text-forest-500 mt-1 flex-shrink-0" />
              <span className="text-sm text-ink-900">{line}</span>
            </div>
          ))}
        </div>
      </Section>
    </MarketingShell>
  );
}
