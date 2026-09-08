import { MarketingShell } from "@/components/marketing/MarketingShell";
import { DocLayout, TocItem } from "@/components/docs/DocLayout";
import { Prose } from "@/components/ui/Prose";
import { H2 } from "@/components/ui/H";

export const metadata = { title: "LeverageLooper enters GA with Morpho Blue markets" };

const toc: TocItem[] = [
  { id: "what", label: "What ships today" },
  { id: "why", label: "Why Morpho Blue" },
  { id: "flow", label: "The user flow" },
  { id: "risk", label: "Risk parameters" },
];

export default function MorphoPost() {
  return (
    <MarketingShell>
      <DocLayout
        meta={{
          eyebrow: "Partnership · March 8, 2026",
          title: "LeverageLooper enters GA with Morpho Blue markets.",
          subtitle:
            "Every filled IPO can now be collateralized against USDG on Morpho Blue in one click, with the borrowed USDG auto-subscribed to the next vault.",
          updated: "March 2026",
        }}
        toc={toc}
        breadcrumbs={[
          { label: "blog", href: "/blog" },
          { label: "morpho-partnership" },
        ]}
      >
        <Prose>
          <H2 id="what">What ships today</H2>
          <p>
            Six new Morpho Blue markets go live on Robinhood Chain,
            paired against USDG:
          </p>
          <ul>
            <li>dCORZ / USDG · LLTV 77.5%</li>
            <li>dRDDT / USDG · LLTV 77.5%</li>
            <li>dTSMC-2 / USDG · LLTV 80%</li>
            <li>dNVDA-B / USDG · LLTV 80%</li>
            <li>dSPY / USDG · LLTV 86%</li>
            <li>dQQQ / USDG · LLTV 86%</li>
          </ul>
          <p>
            The LeverageLooper contract routes user collateral through
            these markets and immediately borrows USDG at the current
            supply rate. The borrowed USDG is then subscribed to a
            user-chosen open SubscriptionVault, still credited to the
            user&apos;s address.
          </p>

          <H2 id="why">Why Morpho Blue</H2>
          <p>
            Morpho Blue is the only lending primitive that lets us deploy
            <em>isolated markets per Stock Token</em> without a governance
            vote per listing. Every market has:
          </p>
          <ul>
            <li>An immutable oracle (Chainlink TR feed).</li>
            <li>An immutable IRM (adaptive-curve).</li>
            <li>An immutable LLTV.</li>
            <li>No admin key. No pause. No parameter drift.</li>
          </ul>
          <p>
            This matches RPO&apos;s ethos: composable primitives, permissionless
            deployment, zero governance risk between the user and their
            collateral.
          </p>

          <H2 id="flow">The user flow</H2>
          <p>
            After claiming a filled IPO, users see a new{" "}
            <strong>Loop</strong> button next to each holding. One click:
          </p>
          <ol>
            <li>
              Approve dTOKEN spend on the LeverageLooper contract (one
              time, or gasless via a Permit2 signature).
            </li>
            <li>
              Select target LTV (default 60%, capped at Morpho market
              LLTV minus 5% for safety buffer).
            </li>
            <li>Select next open vault to subscribe borrowed USDG into.</li>
            <li>Sign. Everything else executes atomically.</li>
          </ol>
          <p>
            Position health is monitored by a Gelato-triggered liquidation
            script; users can add USDG or withdraw collateral at any time
            through the Morpho Blue front-end or the RPO app.
          </p>

          <H2 id="risk">Risk parameters</H2>
          <table>
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Rationale</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Default target LTV</td>
                <td>60%</td>
                <td>Well below every market LLTV; survives a 20% mark drop.</td>
              </tr>
              <tr>
                <td>Health-factor warn threshold</td>
                <td>1.35</td>
                <td>Front-end blocks new loops beyond this.</td>
              </tr>
              <tr>
                <td>Liquidation bot latency</td>
                <td>&lt; 2 blocks</td>
                <td>Gelato + backup keeper set.</td>
              </tr>
              <tr>
                <td>Max loop depth</td>
                <td>3</td>
                <td>
                  Hard cap on recursion — three claims subscribe into three
                  vaults, no further.
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            The looper is not appropriate for every user. Read the{" "}
            <a href="/legal/risk">Risk Disclosure</a> before enabling
            leverage.
          </p>
        </Prose>
      </DocLayout>
    </MarketingShell>
  );
}
