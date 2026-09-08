import { Section, SectionHeader } from "@/components/ui/Section";
import { Zap, Shield, Layers, Coin, Lock, Globe } from "@/components/ui/Icons";

const FEATURES = [
  {
    Icon: Zap,
    title: "Primary-market pricing",
    body: "Vaults route through Rialto's market-maker propAMM the instant a Stock Token is minted — closer to the true IPO fill than sniping a Uniswap pool ever gets you.",
  },
  {
    Icon: Coin,
    title: "Pro-rata allocation",
    body: "Every subscription is weighted by capital committed × $RPO boost. No first-block races, no MEV auctions — the earliest 20 seconds and the last 20 seconds get the same fill.",
  },
  {
    Icon: Lock,
    title: "Refund by default",
    body: "If Robinhood doesn't list the ticker by the fulfillment deadline, anyone can flip the vault into REFUNDED and each subscriber pulls their USDG back 1:1.",
  },
  {
    Icon: Shield,
    title: "Non-custodial",
    body: "Your USDG sits in a per-IPO SubscriptionVault deployed by CREATE2. Post-fulfillment you claim real ERC-8056 Stock Tokens with live uiMultiplier corporate actions built in.",
  },
  {
    Icon: Layers,
    title: "Loop into the next one",
    body: "Claim a Stock Token, drop it into Morpho Blue, borrow USDG, subscribe to the next IPO — one transaction through the LeverageLooper.",
  },
  {
    Icon: Globe,
    title: "Global by construction",
    body: "No KYC on the protocol. Every user in every non-restricted jurisdiction gets the same interface, the same math, and the same fill.",
  },
];

export function Features() {
  return (
    <Section id="features">
      <SectionHeader
        eyebrow="What you get"
        title={
          <>
            The <span className="italic">institutional</span> IPO experience —
            permissionless.
          </>
        }
        description="Six primitives that make on-chain IPO subscription genuinely different from a launchpad, an ICO, or a copy-trade bot."
      />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map(({ Icon, title, body }) => (
          <div
            key={title}
            className="card-soft p-8 hover:shadow-card transition-shadow duration-300"
          >
            <div className="h-11 w-11 rounded-2xl bg-paper-100 border border-line text-ink-900 flex items-center justify-center mb-6">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-ink-900 mb-2">
              {title}
            </h3>
            <p className="text-sm text-ink-500 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
