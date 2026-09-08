import { Metadata } from "next";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Legal",
  description: "Disclosures, terms, privacy, restricted jurisdictions.",
};

export default function LegalPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Legal"
        title="Disclosures & Terms"
        description="Read this in full before interacting with the protocol."
      />

      <Section>
        <Container variant="copy" className="!px-0">
          <article className="prose-editorial">
            <h2 id="disclaimer">General disclaimer</h2>
            <p>
              RPO is a set of open-source smart contracts and a non-custodial
              web interface. RPO Labs does not custody user funds, does not
              execute trades on behalf of users, and does not act as a broker,
              dealer, exchange, or investment adviser.
            </p>
            <p>
              Nothing on this website is investment, legal, or tax advice.
              Interacting with the protocol may result in the total loss of
              deposited assets. You are solely responsible for evaluating the
              risks of on-chain financial activity in your jurisdiction.
            </p>

            <h2 id="stock-tokens">About Robinhood Stock Tokens</h2>
            <p>
              Robinhood Stock Tokens are Reg-S debt securities issued by
              Robinhood Assets (Jersey) Limited (&ldquo;RHJ&rdquo;). Under
              Regulation S they are <strong>not</strong> offered or sold to
              U.S. persons, Canadian residents, residents of the United
              Kingdom, Switzerland, or the United Arab Emirates. RPO does not
              onboard, custody, or transact on behalf of any user; interaction
              with RHJ-issued tokens is a direct relationship between the user
              and RHJ subject to RHJ&apos;s own terms.
            </p>

            <h2 id="restricted">Restricted jurisdictions</h2>
            <p>
              You may not use the RPO web interface if you are a resident,
              citizen, or physically located in a Restricted Jurisdiction,
              including but not limited to:
            </p>
            <ul>
              <li>United States of America (and its territories)</li>
              <li>Canada</li>
              <li>United Kingdom</li>
              <li>Switzerland</li>
              <li>United Arab Emirates</li>
              <li>
                Any jurisdiction subject to comprehensive sanctions
                administered by OFAC, HMT, or the EU (currently including
                Cuba, Iran, North Korea, Syria, and the Crimea, DNR &amp; LNR
                regions of Ukraine)
              </li>
            </ul>
            <p>
              The smart contracts themselves are permissionless. This
              restriction applies to the interface hosted at{" "}
              <code>rpo.xyz</code>.
            </p>

            <h2 id="risk">Risk factors</h2>
            <ul>
              <li>
                <strong>Smart-contract risk.</strong> The protocol&apos;s
                contracts may contain undiscovered vulnerabilities.
              </li>
              <li>
                <strong>Fulfillment risk.</strong> An announced IPO may not
                launch on the expected date. The refund path returns your
                USDG but not opportunity cost.
              </li>
              <li>
                <strong>Liquidity risk.</strong> Rialto propAMM depth may be
                insufficient at launch; the adapter&apos;s fallback path
                (Uniswap V3) may fill at a worse price than expected.
              </li>
              <li>
                <strong>Underlying-security risk.</strong> Once claimed,
                Stock Tokens track underlying equities and may lose value.
              </li>
              <li>
                <strong>Bridge risk.</strong> Bridging USDC/ETH into USDG
                relies on third-party infrastructure (LiFi and its
                connectors) outside RPO&apos;s control.
              </li>
              <li>
                <strong>Regulatory risk.</strong> On-chain equity products
                are a rapidly evolving regulatory space. Rules may change.
              </li>
            </ul>

            <h2 id="terms">Terms of use</h2>
            <p>By using this interface you represent that:</p>
            <ul>
              <li>You are of legal age in your jurisdiction.</li>
              <li>You are not a resident of a Restricted Jurisdiction.</li>
              <li>
                You are not on any sanctions list maintained by any government.
              </li>
              <li>
                You understand that funds sent to smart contracts are
                irrecoverable except via the contracts&apos; own withdrawal
                paths.
              </li>
              <li>
                You will not use the interface for any illegal purpose,
                money-laundering, or terrorism financing.
              </li>
            </ul>

            <h2 id="privacy">Privacy</h2>
            <p>
              RPO Labs does not collect personal information through the
              interface. We use minimal cookies for session state and
              anonymized analytics (aggregate page views, no identifiers). We
              do not sell or share user data. Wallet addresses interacting
              with the contracts are visible on the public blockchain by
              design and are outside our control.
            </p>

            <h2 id="contact">Contact</h2>
            <p>
              Legal / press:{" "}
              <a href="mailto:legal@rpo.xyz">legal@rpo.xyz</a>. Security:{" "}
              <a href="mailto:security@rpo.xyz">security@rpo.xyz</a>.
            </p>

            <p className="text-xs text-fg-dim mt-10">
              Last updated: September 2026.
            </p>
          </article>
        </Container>
      </Section>
    </MarketingShell>
  );
}
