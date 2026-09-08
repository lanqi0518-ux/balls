import { MarketingShell } from "@/components/marketing/MarketingShell";
import { DocLayout, TocItem } from "@/components/docs/DocLayout";
import { Prose } from "@/components/ui/Prose";
import { H2 } from "@/components/ui/H";

export const metadata = { title: "Risk Disclosure" };

const toc: TocItem[] = [
  { id: "regulatory", label: "Regulatory risk" },
  { id: "market", label: "Market risk" },
  { id: "custody", label: "Custody risk" },
  { id: "smart", label: "Smart-contract risk" },
  { id: "oracle", label: "Oracle risk" },
  { id: "settlement", label: "Settlement risk" },
  { id: "chain", label: "Chain risk" },
  { id: "geo", label: "Geographic restrictions" },
  { id: "tax", label: "Tax" },
];

export default function RiskPage() {
  return (
    <MarketingShell>
      <DocLayout
        meta={{
          eyebrow: "Legal",
          title: "Risk Disclosure",
          subtitle:
            "Every material risk of interacting with the RPO protocol, disclosed plainly. This is not exhaustive — you must independently assess suitability for your situation.",
          updated: "March 2026",
        }}
        toc={toc}
        breadcrumbs={[
          { label: "legal", href: "/legal" },
          { label: "risk" },
        ]}
      >
        <Prose>
          <H2 id="regulatory">Regulatory risk</H2>
          <p>
            Robinhood Stock Tokens are Reg-S debt securities issued by
            Robinhood Assets (Jersey) Limited (&quot;RHJ&quot;). The
            regulatory treatment of tokenized securities is evolving in
            every major jurisdiction. Rule changes could restrict, tax, or
            ban your ability to hold, trade, or redeem these tokens. RPO
            has no ability to protect you from such changes. In particular,
            residents of the United States, Canada, the United Kingdom,
            Switzerland, and the United Arab Emirates are prohibited from
            holding Stock Tokens under RHJ&apos;s Reg-S offering documents.
          </p>

          <H2 id="market">Market risk</H2>
          <p>
            Stock prices move. You can lose your entire subscription. IPO
            performance is not predictable; historical first-day pops do
            not guarantee future results. The 2%-fee-plus-boost mechanic
            does not offset market losses. Do not subscribe amounts you
            cannot afford to lose.
          </p>

          <H2 id="custody">Custody risk</H2>
          <p>
            You are the sole custodian of your wallet. If you lose your
            keys, seed phrase, or hardware device, your funds are
            permanently lost. RPO has no support line, no recovery
            mechanism, and no ability to reverse transactions. Consider
            multi-sig and hardware wallets for larger subscriptions.
          </p>

          <H2 id="smart">Smart-contract risk</H2>
          <p>
            Two audits (Trail of Bits, Spearbit) found no critical issues,
            but no audit is a guarantee. Undiscovered bugs could result in
            loss, freezing, or partial recovery of funds. See{" "}
            <a href="/audits">/audits</a> and{" "}
            <a href="/bounty">/bounty</a> for the current status.
          </p>

          <H2 id="oracle">Oracle risk</H2>
          <p>
            SubscriptionVault fulfillment prices depend on Chainlink
            Total-Return feeds. Feed manipulation, outage, or lag could
            cause fills at unexpected prices. RPO mitigates this with a
            30-bps deviation guard and a Rialto → Uniswap V3 fallback, but
            residual risk exists.
          </p>

          <H2 id="settlement">Settlement risk</H2>
          <p>
            The vault relies on RHJ minting the underlying Stock Token by
            the fulfillment deadline. If RHJ delays or cancels the listing,
            the vault refunds subscribers, but you incur opportunity cost
            on the locked USDG (partially offset by Aave yield).
          </p>

          <H2 id="chain">Chain risk</H2>
          <p>
            Robinhood Chain is an Arbitrum Orbit L2 sequenced by Robinhood.
            Sequencer downtime, reorgs, or a compromise of the L1 escape
            hatch could delay or freeze protocol operations. In the worst
            case, users can forcibly withdraw via the L1 bridge after a
            7-day window.
          </p>

          <H2 id="geo">Geographic restrictions</H2>
          <p>
            The RPO interfaces geo-block IP addresses from Restricted
            Jurisdictions. Attempting to circumvent the geo-block violates
            the Terms of Service and may violate the securities laws of
            your jurisdiction. RPO Labs makes no representation that the
            protocol is legally usable in your country; that determination
            is your responsibility.
          </p>

          <H2 id="tax">Tax</H2>
          <p>
            You are responsible for all taxes arising from your use of the
            protocol, including but not limited to income tax on realized
            gains from Stock Token appreciation, staking rewards, or
            LeverageLooper positions. RPO Labs does not provide tax
            reporting, K-1s, 1099s, or any equivalent forms. Consult a
            qualified tax professional in your jurisdiction.
          </p>
        </Prose>
      </DocLayout>
    </MarketingShell>
  );
}
