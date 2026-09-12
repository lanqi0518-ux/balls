import { Section, SectionHeader } from "@/components/ui/Section";
import { LinkButton } from "@/components/ui/Button";
import { ArrowRight } from "@/components/ui/Icons";

const STEPS = [
  {
    n: "01",
    title: "Pre-subscribe with USDG",
    body: "Pick an announced IPO. Deposit USDG (or bridge in USDC/ETH via LiFi). Your weight = deposit × $RPO boost.",
  },
  {
    n: "02",
    title: "Wait for the mint",
    body: "Our keeper watches /rhj/assets. When Robinhood mints the Stock Token, the vault fires markLaunched() and buys through Rialto propAMM.",
  },
  {
    n: "03",
    title: "Claim your allocation",
    body: "The vault distributes tokens pro-rata by weight. Claim, hold, sell on Rialto, or loop into the next IPO through Morpho Blue.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how" className="bg-paper-100 border-y border-line">
      <SectionHeader
        eyebrow="How it works"
        title="Three transactions. One flywheel."
        description="From announcement to allocation, everything is on-chain, deterministic, and refundable."
      />

      <div className="grid lg:grid-cols-3 gap-4">
        {STEPS.map((s, i) => (
          <div
            key={s.n}
            className="card-soft p-10 relative overflow-hidden animate-fade-in-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="text-[10px] uppercase tracking-[0.22em] text-ink-500 font-mono mb-6">
              Step {s.n}
            </div>
            <div className="font-display text-6xl lg:text-7xl text-ink-900 leading-none mb-6">
              {s.n}
            </div>
            <h3 className="text-xl font-semibold text-ink-900 mb-3">
              {s.title}
            </h3>
            <p className="text-sm text-ink-500 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 flex justify-center">
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
