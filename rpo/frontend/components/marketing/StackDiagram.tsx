import { Section, SectionHeader } from "@/components/ui/Section";
import { Sphere } from "@/components/ui/Sphere";

const LAYERS = [
  {
    tag: "Your wallet",
    tone: "peach",
    items: ["USDG on Robinhood Chain", "any token via LiFi bridge"],
  },
  {
    tag: "RPO protocol",
    tone: "ink",
    items: [
      "IPORegistry",
      "SubscriptionVault",
      "AllocationBooster",
      "RialtoAdapter",
      "LeverageLooper",
    ],
  },
  {
    tag: "Robinhood Chain infra",
    tone: "forest",
    items: [
      "Rialto propAMM",
      "Uniswap V3",
      "Chainlink oracles",
      "Morpho Blue",
    ],
  },
  {
    tag: "Off-chain",
    tone: "default",
    items: [
      "Robinhood /rhj/assets",
      "RHJ (Reg-S issuer)",
      "Chainlink Automation",
    ],
  },
];

export function StackDiagram() {
  return (
    <Section id="stack" className="relative overflow-hidden">
      <Sphere
        variant="peach"
        size={280}
        className="absolute top-20 -right-20 opacity-60 pointer-events-none"
      />
      <Sphere
        variant="forest"
        size={200}
        className="absolute bottom-20 -left-16 opacity-50 pointer-events-none"
      />
      <SectionHeader
        eyebrow="The stack"
        title={
          <>
            Real infrastructure. <span className="italic">Not synthetic.</span>
          </>
        }
        description="Every layer below already exists in production on Robinhood Chain. RPO is the missing subscription primitive on top."
      />
      <div className="relative rounded-3xl border border-line bg-white p-6 lg:p-10 shadow-card">
        <div className="space-y-3">
          {LAYERS.map((l) => (
            <div
              key={l.tag}
              className="rounded-2xl border border-line bg-paper-50 p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <span
                  className={
                    "h-2.5 w-2.5 rounded-full " +
                    (l.tone === "ink"
                      ? "bg-ink-900"
                      : l.tone === "peach"
                      ? "bg-peach-500"
                      : l.tone === "forest"
                      ? "bg-forest-500"
                      : "bg-ink-300")
                  }
                />
                <span className="text-[11px] uppercase tracking-[0.22em] text-ink-500 font-mono">
                  {l.tag}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {l.items.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-lg border border-line bg-white px-3 py-1.5 text-xs text-ink-900 font-mono"
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
