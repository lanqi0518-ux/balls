import { Section, SectionHeader } from "@/components/ui/Section";
import { Zap, Shield, Layers, Coin, Lock, Globe } from "@/components/ui/Icons";

const FEATURES = [
  {
    Icon: Zap,
    title: "First-block execution",
    body: "PreMintVault subscribers get filled the block RHJ mints the token — before /rhj/assets updates and before the front-end feed reaches Robinhood.com. The keeper bounty (max 2% of pot) exists solely to guarantee this racelessness.",
  },
  {
    Icon: Coin,
    title: "Chainlink-bounded slippage",
    body: "Every routing call — PreMintVault.fulfill, PredictionMarket.resolveYes, LockupHedgeVault.trigger — is capped at Chainlink's mark ± caller-supplied slippage bps. Malicious keepers can't route into an empty pool for a bounty.",
  },
  {
    Icon: Lock,
    title: "Refund is the default",
    body: "Every vault flips into refund mode after its fulfillment deadline. No keeper ever caught the mint? Anyone can call activateRefund() permissionlessly and every subscriber recovers USDG 1:1. No trust in HOODIPO required.",
  },
  {
    Icon: Shield,
    title: "No admin, no upgradability",
    body: "PreMintFactory, AntiSnipeHook, CorpActionsRegistry, PhysicalPredictionMarket, LockupHedgeVault — none of them have owners or proxies. What deploys is what runs. The only mutable state is user-controlled positions.",
  },
  {
    Icon: Layers,
    title: "Composable with the rest of RH Chain",
    body: "AntiSnipeHook exempts wallets holding PreMintVault receipts. CorpActionsRegistry can auto-swap into the next PreMintVault. LockupHedgeVault settles into USDG that Robinhood Earn will accept as collateral. One stack.",
  },
  {
    Icon: Globe,
    title: "Zero KYC on the protocol",
    body: "Robinhood already enforces Reg-S eligibility at the wallet layer for Stock Tokens (a single Attester check gates every RHJ mint). HOODIPO adds no new KYC — every non-US, non-restricted wallet gets the same primitives.",
  },
];

export function Features() {
  return (
    <Section id="features">
      <SectionHeader
        eyebrow="Engineering guarantees"
        title={
          <>
            Six invariants that make HOODIPO{" "}
            <span className="italic">actually trust-minimised</span>.
          </>
        }
        description="What you don't see in a launchpad's marketing site: every user-facing promise here is enforced by the constructor, not by a governance vote."
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
