import type { Metadata } from "next";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Section, SectionHeader } from "@/components/ui/Section";
import { PrimitiveDeployBanner } from "@/components/hoodipo/PrimitiveDeployBanner";
import { StrategyBuilder } from "@/components/hoodipo/StrategyBuilder";
import { CONTRACTS } from "@/lib/chain";
import { Check } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "Programmable corporate actions · CorpActionsRegistry",
  description:
    "HOODIPO's primitive 03. Arm on-chain reactions to Robinhood Stock Token uiMultiplier events — dividends, splits, distributions — and let any keeper execute the swap for you the moment the ratio moves.",
};

const STRATEGY_TYPES = [
  {
    kind: "TOP_UP",
    tag: "Dividend reinvestment",
    body: "When uiMultiplier() rises (dividend accrual), pull topUpAmount USDG from your wallet and buy more of the same token — automatic DRIP. Trigger fires only when the delta ≥ your minDeltaBps threshold.",
    example:
      "arm(dSPY, TOP_UP, minDeltaBps=25, topUpAmount=100e6) — every quarterly SPY dividend auto-reinvests $100.",
  },
  {
    kind: "REBALANCE_TO_USDG",
    tag: "Distribution catch",
    body: "When uiMultiplier() drops (special dividend, spinoff distribution), swap maxTokensPerTrigger d-TICKER back into USDG immediately. Frees capital for the next opportunity while catching the distribution price shock.",
    example:
      "arm(dMSTR, REBALANCE_TO_USDG, minDeltaBps=100, maxTokensPerTrigger=10e18) — any 1%+ drop auto-derisks 10 tokens.",
  },
  {
    kind: "NOTIFY",
    tag: "Accounting webhook",
    body: "No swap. Just an on-chain event with the old + new multiplier and the delta bps. Downstream: your indexer, your tax software, your reporting dashboard. Ideal for read-only wallets and multi-sigs.",
    example: "arm(dRDDT, NOTIFY, minDeltaBps=1) — every uiMultiplier movement emits StrategyExecuted for indexers.",
  },
];

const INVARIANTS = [
  "Owner-only disarm — strategy state cannot be flipped by anyone else. If you disarm, the keeper's execute reverts.",
  "Delta check is strict: keeper cannot execute unless the current uiMultiplier moves by ≥ minDeltaBps since the last execution.",
  "TOP_UP requires uiMultiplier > previous. REBALANCE_TO_USDG requires uiMultiplier < previous. No direction spoofing.",
  "Router calldata comes from the keeper, but the slippage floor (minAmountOut) is enforced by CorpActionsRegistry — sandwich the keeper and you eat the revert, not the vault.",
  "Fees and keeper bounty are hard-capped at 2% each at construction. Immutable.",
];

export default function StrategiesPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Primitive 03 · CorpActionsRegistry"
        title={
          <>
            Programmable reactions to every{" "}
            <span className="italic text-forest-500">uiMultiplier</span> event.
          </>
        }
        description="Every Robinhood Stock Token implements ERC-8056: an on-chain uiMultiplier() that scales holdings when RHJ credits dividends, splits, or distributions. HOODIPO lets you arm a strategy on any (token, delta_bps) tuple. When the ratio moves, any keeper executes your pre-authorised swap and takes a bounty out of the trade — you keep the direction, they compete on latency."
      />

      <Section>
        <PrimitiveDeployBanner
          primitive="CorpActionsRegistry · Primitive 03"
          address={CONTRACTS.corpActions}
          githubPath="https://github.com/lanqi0518-ux/hoodipo/blob/main/rpo/contracts/src/hoodipo/CorpActionsRegistry.sol"
        />

        <div className="mt-10 grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <StrategyBuilder />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="card-soft p-6">
              <div className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono mb-3">
                Where uiMultiplier lives
              </div>
              <p className="text-sm text-ink-500 leading-relaxed">
                Every d-TICKER on Robinhood Chain exposes{" "}
                <code className="font-mono text-xs bg-paper-100 px-1.5 py-0.5 rounded">
                  uiMultiplier() → uint256
                </code>{" "}
                (18-decimal). Robinhood updates the value atomically when
                RHJ credits a corporate action. The registry reads the
                value at arm time (baseline) and at execute time (new); the
                delta in bps is the trigger.
              </p>
              <div className="mt-4 rounded-xl bg-paper-100 border border-line p-4 text-xs font-mono text-ink-900">
                <pre className="whitespace-pre-wrap leading-relaxed">
{`interface IERC8056 {
  function uiMultiplier() returns (uint256);
  function balanceOfUI(address) returns (uint256);
  function totalSupplyUI() returns (uint256);
  event UIMultiplierUpdated(
    uint256 oldMultiplier,
    uint256 newMultiplier,
    uint256 effectiveAtTimestamp
  );
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section className="border-t border-line bg-paper-100">
        <SectionHeader
          eyebrow="Three strategy kinds"
          title="The v0 shipping menu."
          description="Composable enough to cover 90% of what a normal holder wants without turning into a scripting language."
        />
        <div className="grid md:grid-cols-3 gap-4">
          {STRATEGY_TYPES.map((s) => (
            <div key={s.kind} className="card p-8">
              <div className="text-[10px] uppercase tracking-[0.18em] text-forest-500 font-mono">
                {s.tag}
              </div>
              <div className="mt-2 font-mono text-lg text-ink-900">
                {s.kind}
              </div>
              <p className="mt-4 text-sm text-ink-500 leading-relaxed">
                {s.body}
              </p>
              <div className="mt-4 text-[11px] font-mono text-ink-900 bg-paper-100 rounded-lg p-3 leading-relaxed">
                {s.example}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="Five invariants"
          title="What the registry guarantees."
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
