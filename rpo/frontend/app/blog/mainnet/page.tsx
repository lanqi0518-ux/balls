import { Metadata } from "next";
import Link from "next/link";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Section } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { ArrowRight } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "RPO v1 is live",
  description:
    "The permissionless IPO subscription protocol is now live on Robinhood Chain.",
};

export default function BlogPost() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Announcement · Sep 2026"
        title="RPO v1 is live on Robinhood Chain."
      />
      <Section>
        <Container variant="copy" className="!px-0">
          <article className="prose-editorial">
            <p>
              Today RPO ships to mainnet on Robinhood Chain. Anyone with a
              wallet, USDG, and 20 seconds can now subscribe to a tokenized
              IPO the moment it&apos;s announced — no broker account, no KYC
              flow, no jurisdiction gates at the protocol layer.
            </p>

            <h2>Why this matters</h2>
            <p>
              For the first time in this cycle, we have a securities-token
              stack that isn&apos;t synthetic. Robinhood mints real Stock
              Tokens (Reg-S debt securities against real US shares) directly
              on-chain, priced by Chainlink total-return feeds, tradeable
              through Rialto&apos;s market-maker propAMM. What was missing
              was a primary-market primitive — a way for a global user to
              catch a listing at the same fill Robinhood itself gets.
            </p>

            <p>That primitive is RPO.</p>

            <h2>What&apos;s in v1</h2>
            <ul>
              <li>
                <strong>IPORegistry + SubscriptionVault:</strong> per-IPO
                CREATE2 vaults, deposit USDG, weighted pro-rata allocation,
                refund by default.
              </li>
              <li>
                <strong>AllocationBooster:</strong> stake $RPO for up to 3×
                allocation multiplier, sqrt curve.
              </li>
              <li>
                <strong>RialtoAdapter:</strong> best-price routing through
                Rialto propAMM, Uniswap V3 fallback, 0x RFQ hook.
              </li>
              <li>
                <strong>LeverageLooper:</strong> claim a Stock Token → drop
                into Morpho Blue → borrow USDG → subscribe to the next IPO,
                atomically.
              </li>
              <li>
                <strong>Keeper:</strong> Node.js poller against
                <code> /rhj/assets</code> that fires{" "}
                <code>markLaunched()</code> the second a Stock Token appears
                on-chain.
              </li>
            </ul>

            <h2>Read next</h2>
            <p>
              The full protocol spec lives at{" "}
              <Link href="/how-it-works">/how-it-works</Link>. Security
              posture, threat model, and bug bounty at{" "}
              <Link href="/security">/security</Link>. If you&apos;re a
              developer,{" "}
              <Link href="/docs">/docs</Link> is your entry point.
            </p>

            <p>
              And if you want to just try it: click below.
            </p>
          </article>

          <div className="mt-10">
            <LinkButton
              href="/app"
              size="lg"
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              Launch the app
            </LinkButton>
          </div>
        </Container>
      </Section>
    </MarketingShell>
  );
}
