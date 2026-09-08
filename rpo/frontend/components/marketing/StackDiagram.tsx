import { Section, SectionHeader } from "@/components/ui/Section";

const LAYERS = [
  {
    tag: "Your wallet",
    tone: "cream",
    items: ["USDG on Robinhood Chain", "any token via LiFi bridge"],
  },
  {
    tag: "RPO protocol",
    tone: "mint",
    items: [
      "IPORegistry (announce + deploy)",
      "SubscriptionVault (deposit + allocate)",
      "AllocationBooster ($RPO stake)",
      "RialtoAdapter (best-price routing)",
      "LeverageLooper (Morpho re-subscribe)",
    ],
  },
  {
    tag: "Robinhood Chain infra",
    tone: "default",
    items: [
      "Rialto propAMM (market-maker quotes)",
      "Uniswap V3 (fallback venue)",
      "Chainlink total-return oracles",
      "Morpho Blue (Stock Token lending)",
    ],
  },
  {
    tag: "Off-chain",
    tone: "default",
    items: [
      "Robinhood /rhj/assets & /rhj/prices",
      "RHJ (Reg-S issuer)",
      "Chainlink Automation keeper",
    ],
  },
];

export function StackDiagram() {
  return (
    <Section id="stack">
      <SectionHeader
        eyebrow="The stack"
        title={
          <>
            Real infrastructure.{" "}
            <span className="italic text-mint-500">Not synthetic.</span>
          </>
        }
        description="Every layer below already exists in production on Robinhood Chain. RPO is the missing subscription primitive on top."
      />
      <div className="rounded-3xl border border-line bg-ink-800/40 p-6 lg:p-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-cream-glow pointer-events-none" />
        <div className="relative space-y-4">
          {LAYERS.map((l) => (
            <div
              key={l.tag}
              className="rounded-2xl border border-line bg-ink-800 p-5 lg:p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <span
                  className={
                    "h-2 w-2 rounded-full " +
                    (l.tone === "mint"
                      ? "bg-mint-500"
                      : l.tone === "cream"
                      ? "bg-cream"
                      : "bg-fg-dim")
                  }
                />
                <span className="text-xs uppercase tracking-[0.14em] text-fg-muted font-mono">
                  {l.tag}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {l.items.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-lg border border-line bg-ink-900 px-3 py-1.5 text-xs text-fg font-mono"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
