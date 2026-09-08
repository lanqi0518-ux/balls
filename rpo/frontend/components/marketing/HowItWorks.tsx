import { Section, SectionHeader } from "@/components/ui/Section";
import { LinkButton } from "@/components/ui/Button";
import { ArrowRight } from "@/components/ui/Icons";

const STEPS = [
  {
    n: "01",
    title: "Pre-subscribe with USDG",
    body: "Pick an announced IPO. Deposit USDG (or bridge in USDC/ETH via LiFi). Your weight = deposit × your $RPO boost. The window is a fixed number of hours.",
  },
  {
    n: "02",
    title: "Wait for the mint",
    body: "Our keeper watches /rhj/assets. The moment Robinhood mints the Stock Token on-chain, the vault fires markLaunched() and starts buying through Rialto propAMM.",
  },
  {
    n: "03",
    title: "Claim your allocation",
    body: "The vault distributes Stock Tokens pro-rata by weight. Claim, hold, sell on Rialto/Uniswap, or drop into Morpho Blue and loop into the next IPO.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how" className="bg-ink-800/30 border-y border-line">
      <SectionHeader
        eyebrow="How it works"
        title="Three transactions. One flywheel."
        description="From announcement to allocation, everything is on-chain, deterministic, and refundable."
      />
      <div className="grid lg:grid-cols-3 gap-6">
        {STEPS.map((s) => (
          <div key={s.n} className="card p-8 relative overflow-hidden">
            <div className="absolute top-4 right-6 font-display text-6xl text-mint-500/10 leading-none">
              {s.n}
            </div>
            <div className="relative">
              <div className="text-xs uppercase tracking-[0.14em] text-mint-400 font-mono mb-4">
                Step {s.n}
              </div>
              <h3 className="text-xl font-semibold text-fg mb-3">{s.title}</h3>
              <p className="text-sm text-fg-muted leading-relaxed">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        <LinkButton
          href="/how-it-works"
          variant="outline"
          size="md"
          trailingIcon={<ArrowRight className="h-4 w-4" />}
        >
          Read the full protocol spec
        </LinkButton>
      </div>
    </Section>
  );
}
