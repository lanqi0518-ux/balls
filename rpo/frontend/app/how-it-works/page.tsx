import { Metadata } from "next";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { ArrowRight, Check } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "The full RPO subscription lifecycle — from announcement to allocation.",
};

const LIFECYCLE = [
  {
    n: "01",
    tag: "Announce",
    title: "IPORegistry announces the vault",
    body: "A keeper (or the protocol admin) reads Robinhood's upcoming-listing feed and calls announceIPO(ticker, subscriptionWindow, targetUSD). A SubscriptionVault is deployed via CREATE2 so the address is predictable — you can even bridge USDG into it before it exists.",
    code: "IPORegistry.announceIPO(\n  \"STRIPE\",\n  targetUSD = 5_000_000,\n  subscriptionDeadline = now + 3 days\n);",
  },
  {
    n: "02",
    tag: "Subscribe",
    title: "Users deposit USDG",
    body: "During the subscription window anyone can call subscribe(amount). Your weight equals amount × yourBoost, where boost comes from AllocationBooster.getBoost(msg.sender). Subscribe once, top up as many times as you want, or cancel before the deadline for a 100% refund.",
    code: "SubscriptionVault.subscribe(500e6);\n// weight = 500e6 * 2.5x boost = 1250\n// You can call cancel() any time until deadline.",
  },
  {
    n: "03",
    tag: "Detect",
    title: "Keeper watches /rhj/assets",
    body: "Our off-chain keeper polls Robinhood's asset feed. The moment the target Stock Token flips to ASSET_STATUS_ACTIVE with a deployment on chain ID 4663, the keeper calls IPORegistry.markLaunched(key, stockToken).",
    code: "// pseudo:\nassets.filter(a => a.status === \"ACTIVE\" && a.tokenSymbol === \"dSTRIPE\")\n      .forEach(a => registry.markLaunched(key, a.deployments[0]));",
  },
  {
    n: "04",
    tag: "Fulfill",
    title: "RialtoAdapter buys at best price",
    body: "The vault delegates to RialtoAdapter.buyBestPrice(). It quotes Rialto propAMM first, falls back to Uniswap V3, and can be extended to 0x RFQ. The full USDG float is exchanged for Stock Tokens and locked for pro-rata claim.",
    code: "adapter.buyBestPrice(usdgIn = 5_000_000e6, stockToken);\n// primary path: Rialto propAMM (near-primary fill)\n// fallback:     Uniswap V3 (if Rialto paused / slipping)",
  },
  {
    n: "05",
    tag: "Claim",
    title: "Subscribers claim tokens",
    body: "Once markFulfilled has been called, anyone can call claim(). You receive dSTRIPE proportional to your weight ÷ totalWeight. Any leftover USDG (from an under-filled vault) is refunded pro-rata in the same tx.",
    code: "SubscriptionVault.claim();\n// tokens = totalStock * yourWeight / totalWeight\n// refund = totalUnfilled * yourDeposit / totalDeposits",
  },
  {
    n: "06",
    tag: "Loop",
    title: "Loop into the next IPO",
    body: "Approve LeverageLooper for the Stock Token, call loopIntoNextIPO(stockToken, amt, nextVault, borrowUSDG). The looper supplies collateral to Morpho Blue, borrows USDG, and subscribes to the next vault — all atomically.",
    code: "looper.loopIntoNextIPO({\n  stockToken: dSTRIPE,\n  amount:     5.88e18,\n  nextVault:  vaults.KLARNA,\n  borrowUSDG: 350e6\n});",
  },
];

export default function HowItWorksPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Product"
        title={
          <>
            One contract per IPO. Six calls from{" "}
            <span className="italic text-mint-500">deposit</span> to{" "}
            <span className="italic text-mint-500">exit</span>.
          </>
        }
        description="Everything RPO does happens on public contracts on Robinhood Chain. There is no off-chain matching engine, no proprietary order book, and no admin key that can seize your allocation."
      />

      <Section>
        <div className="space-y-4">
          {LIFECYCLE.map((s, i) => (
            <LifecycleRow key={s.n} step={s} reverse={i % 2 === 1} />
          ))}
        </div>
      </Section>

      <Section className="border-t border-line bg-ink-800/30">
        <SectionHeader
          eyebrow="Invariants"
          title="Things that are true by construction."
          description="These aren't features. They're properties enforced by the code and testable in Foundry."
        />
        <div className="grid md:grid-cols-2 gap-4">
          {[
            "You can always withdraw before subscriptionDeadline for 100% USDG.",
            "If the fulfillment deadline passes without launch, anyone can flip to REFUNDED.",
            "Vault admin cannot change your allocation, seize funds, or upgrade the contract.",
            "Fees are hard-capped at 2% and go straight to the buyback wallet.",
            "Rialto quote is checked against Uniswap V3; the better fill wins.",
            "Stock Tokens use ERC-8056 uiMultiplier, so splits and dividends are automatic.",
          ].map((line) => (
            <div key={line} className="card p-5 flex items-start gap-3">
              <Check className="h-4 w-4 text-mint-400 mt-1 flex-shrink-0" />
              <span className="text-sm text-fg">{line}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <Container variant="copy" className="text-center">
          <h2 className="font-display text-display-sm text-fg">
            Want more depth?
          </h2>
          <p className="mt-4 text-fg-muted">
            The full protocol spec, contract ABIs, and audit history live in
            the docs.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <LinkButton
              href="/docs"
              size="md"
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              Read docs
            </LinkButton>
            <LinkButton
              href="/security"
              variant="outline"
              size="md"
            >
              Security & audits
            </LinkButton>
          </div>
        </Container>
      </Section>
    </MarketingShell>
  );
}

function LifecycleRow({
  step,
  reverse,
}: {
  step: (typeof LIFECYCLE)[number];
  reverse?: boolean;
}) {
  return (
    <div
      className={
        "grid lg:grid-cols-2 gap-6 items-stretch " +
        (reverse ? "lg:[direction:rtl]" : "")
      }
    >
      <div className="card p-8 lg:p-10 [direction:ltr]">
        <div className="text-xs uppercase tracking-[0.14em] text-mint-400 font-mono">
          Step {step.n} · {step.tag}
        </div>
        <h3 className="mt-3 font-display text-3xl text-fg">{step.title}</h3>
        <p className="mt-4 text-fg-muted leading-relaxed">{step.body}</p>
      </div>
      <div className="card p-6 lg:p-8 bg-ink-900 [direction:ltr] overflow-hidden">
        <div className="text-[10px] uppercase tracking-[0.14em] text-fg-dim font-mono mb-4">
          Solidity
        </div>
        <pre className="text-xs lg:text-sm font-mono text-fg leading-relaxed whitespace-pre overflow-x-auto">
          <code>{step.code}</code>
        </pre>
      </div>
    </div>
  );
}
