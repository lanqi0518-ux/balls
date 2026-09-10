import type { Metadata } from "next";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Section, SectionHeader } from "@/components/ui/Section";
import { PrimitiveDeployBanner } from "@/components/hoodipo/PrimitiveDeployBanner";
import { VaultHuntPanel } from "@/components/hoodipo/VaultHuntPanel";
import { RecentIpoStrip } from "@/components/hoodipo/RecentIpoStrip";
import { getBuyableRecentIpos } from "@/lib/ipos/recent";
import { CONTRACTS } from "@/lib/chain";
import { Check } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "Pre-mint vault · PreMintVault",
  description:
    "HOODIPO's primitive 01. Deploy a permissionless CREATE2 vault the moment you spot an IPO rumor. Subscribers deposit USDG; the first keeper to submit an RHJ-signed attestation the block the ticker mints wins the pot fill.",
};

export const dynamic = "force-dynamic";
export const revalidate = 60;

const INVARIANTS = [
  "You can cancel() and withdraw 100% of your USDG at any time before the pot is spent — even after the subscription deadline lapses.",
  "If no keeper lands fulfill() before the fulfillment deadline, anyone (not the team) can call activateRefund() and every subscriber recovers USDG 1:1.",
  "fulfill() reverts unless the discovered token matches an RHJ-signed attestation (or the on-chain assets registry). Wrong token = revert.",
  "Slippage is capped by the Chainlink mark × (10_000 − maxSlippageBps) / 10_000. A malicious keeper cannot route into an empty V4 pool for the bounty.",
  "Platform fee is hard-capped at 5%; keeper bounty at 2%. Both are set at construction and immutable.",
  "PreMintFactory has no admin, no owner, no upgrade path. What deploys is what runs, permanently.",
];

export default function VaultPage() {
  const recent = getBuyableRecentIpos().slice(0, 6);

  return (
    <MarketingShell>
      <PageHero
        eyebrow="Primitive 01 · PreMintVault"
        title={
          <>
            One vault per ticker. Deployed{" "}
            <span className="italic text-forest-500">before</span> the mint,
            filled the <span className="italic text-forest-500">block</span> of
            the mint.
          </>
        }
        description="Any wallet can call announce(ticker) to permissionlessly deploy a CREATE2 vault the moment they spot a filing, rumor, or leak. Deposits sit in USDG for 24h. The block Robinhood's RHJ mints the token on-chain, the first keeper to submit an RHJ-signed attestation routes the entire pot through UniversalRouter and earns a bounty from the swap."
      />

      <Section>
        <PrimitiveDeployBanner
          primitive="PreMintFactory · Primitive 01"
          address={CONTRACTS.preMintFactory}
          githubPath="https://github.com/lanqi0518-ux/hoodipo/blob/main/rpo/contracts/src/hoodipo/PreMintFactory.sol"
        />

        <div className="mt-10 grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <VaultHuntPanel />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="card-soft p-6">
              <div className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono mb-3">
                How the flow closes
              </div>
              <ol className="space-y-3 text-sm text-ink-500 leading-relaxed">
                <li>
                  <span className="text-ink-900 font-semibold">01.</span>{" "}
                  Anyone calls <code className="font-mono text-xs bg-paper-100 px-1.5 py-0.5 rounded">announce(ticker)</code>. CREATE2 deploys{" "}
                  <code className="font-mono text-xs bg-paper-100 px-1.5 py-0.5 rounded">PreMintVault</code> at a predictable address.
                </li>
                <li>
                  <span className="text-ink-900 font-semibold">02.</span>{" "}
                  Subscribers approve USDG and call{" "}
                  <code className="font-mono text-xs bg-paper-100 px-1.5 py-0.5 rounded">subscribe(amount)</code>. Position tracked in{" "}
                  <code className="font-mono text-xs bg-paper-100 px-1.5 py-0.5 rounded">deposits[msg.sender]</code>.
                </li>
                <li>
                  <span className="text-ink-900 font-semibold">03.</span>{" "}
                  When RHJ mints the Stock Token, any keeper submits{" "}
                  <code className="font-mono text-xs bg-paper-100 px-1.5 py-0.5 rounded">fulfill(token, sig, minOut, cmds, inputs, slip)</code>.
                </li>
                <li>
                  <span className="text-ink-900 font-semibold">04.</span>{" "}
                  Vault verifies the attestation, caps slippage at{" "}
                  <code className="font-mono text-xs bg-paper-100 px-1.5 py-0.5 rounded">chainlinkMark ± slip</code>, routes through UniversalRouter,
                  pays platform fee + keeper bounty out of the pot.
                </li>
                <li>
                  <span className="text-ink-900 font-semibold">05.</span>{" "}
                  Subscribers call <code className="font-mono text-xs bg-paper-100 px-1.5 py-0.5 rounded">claim()</code> and receive
                  their pro-rata d-TICKER share.
                </li>
              </ol>
            </div>

            <div className="card-soft p-6">
              <div className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono mb-3">
                Composability
              </div>
              <p className="text-sm text-ink-500 leading-relaxed">
                Once you hold a claim receipt, the{" "}
                <code className="font-mono text-xs bg-paper-100 px-1.5 py-0.5 rounded">AntiSnipeHook</code> (Primitive 02) treats you as
                exempt from the decaying size cap on the very first V4
                pool — so you can also add liquidity, sell into
                aftermarket, or hedge without racing MEV. Two primitives,
                one wallet.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section className="border-t border-line bg-paper-100">
        <SectionHeader
          eyebrow="Six invariants"
          title="What you can trust without reading the code."
          description="Every line below is enforced by PreMintVault's constructor + control-flow, not by anyone at HOODIPO."
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

      <Section>
        <SectionHeader
          eyebrow="Reference"
          title="What a live PreMintVault pot could look like."
          description="Robinhood already listed these tickers as Stock Tokens — a PreMintVault hunt that had opened the day before each mint would have captured their first-block fill."
        />
        <RecentIpoStrip ipos={recent} />
      </Section>
    </MarketingShell>
  );
}
