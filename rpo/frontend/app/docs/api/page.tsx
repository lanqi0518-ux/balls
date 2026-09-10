import { MarketingShell } from "@/components/marketing/MarketingShell";
import { DocLayout, TocItem } from "@/components/docs/DocLayout";
import { Prose } from "@/components/ui/Prose";
import { H2, H3 } from "@/components/ui/H";

export const metadata = {
  title: "REST API",
  description: "Public REST endpoints for reading IPOs, subscriptions and boost state.",
};

const toc: TocItem[] = [
  { id: "auth", label: "Authentication" },
  { id: "ipos", label: "IPOs" },
  { id: "list", label: "List active IPOs", depth: 3 },
  { id: "detail", label: "Get IPO detail", depth: 3 },
  { id: "history", label: "Historic IPOs", depth: 3 },
  { id: "subs", label: "Subscriptions" },
  { id: "user", label: "By user", depth: 3 },
  { id: "vault", label: "By vault", depth: 3 },
  { id: "boost", label: "Booster" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "webhooks", label: "Webhooks" },
  { id: "errors", label: "Errors" },
];

export default function ApiPage() {
  return (
    <MarketingShell>
      <DocLayout
        meta={{
          eyebrow: "Reference · REST v1 (draft)",
          title: "REST API",
          subtitle:
            "Planned read-only endpoints for the RPO indexer. Pre-launch — none of these endpoints are currently live.",
          updated: "Draft",
        }}
        toc={toc}
        breadcrumbs={[
          { label: "docs", href: "/docs" },
          { label: "api" },
        ]}
      >
        <Prose>
          <blockquote>
            <strong>Pre-launch notice.</strong> RPO is not deployed and the
            indexer described below has not been stood up. This page
            documents the planned REST surface so integrators can review it
            in advance. All base URLs, API-key issuance, and rate-limit
            numbers are targets, not live infrastructure.
          </blockquote>

          <p>
            Planned base URL:{" "}
            <code>https://api.rpo.xyz/v1</code>. All endpoints will
            support <code>?limit</code>, <code>?offset</code> and{" "}
            <code>?cursor</code> pagination. Response shapes are described
            below.
          </p>

          <H2 id="auth">Authentication</H2>
          <p>
            Read endpoints are planned to be open. Higher rate limits and
            webhook registration will require an API key. The key can be
            sent as either <code>X-RPO-API-Key: rpo_live_xxx</code> or the{" "}
            <code>Authorization: Bearer rpo_live_xxx</code> header.
          </p>

          <H2 id="ipos">IPOs</H2>

          <H3 id="list">GET /ipos</H3>
          <p>
            Returns paginated IPOs, most-recent first. Filter with{" "}
            <code>?status=Subscribing|Announced|Fulfilled|Refunded</code>.
          </p>
          <pre>
            <code>{`curl https://api.rpo.xyz/v1/ipos?status=Subscribing

{
  "data": [
    {
      "ticker": "STRIPE",
      "name": "Stripe, Inc.",
      "vault": "0xa1b2…c3d4",
      "status": "Subscribing",
      "subscribedUSD": "2300000",
      "targetUSD": "5000000",
      "expectedPrice": "85.20",
      "subscriptionDeadline": 1741996800,
      "fulfillmentDeadline": 1742256000,
      "boostAppliedToVault": true
    }
  ],
  "next_cursor": null
}`}</code>
          </pre>

          <H3 id="detail">GET /ipos/:ticker</H3>
          <p>
            Full detail plus the last 100 subscriptions and current
            fill-progress bucket.
          </p>

          <H3 id="history">GET /ipos/history</H3>
          <p>
            Every fulfilled or refunded vault with launch price, current
            mark, all-time volume, and top 3 subscribers by weight.
          </p>

          <H2 id="subs">Subscriptions</H2>

          <H3 id="user">GET /subscriptions?address=0x…</H3>
          <p>
            All active and historical subscriptions for a given address
            across every vault. Response includes computed{" "}
            <code>currentBoost</code> and{" "}
            <code>projectedAllocation</code> per line.
          </p>

          <H3 id="vault">GET /vaults/:address/subscriptions</H3>
          <p>
            Enumerate subscribers of a single vault, sorted by weight.
            Useful for pre-launch leaderboards.
          </p>

          <H2 id="boost">Booster</H2>
          <p>
            <code>GET /boost/:address</code> returns the user&apos;s staked
            amount, current boost multiplier, epoch-share, and streamed
            fee-buyback yield to date.
          </p>

          <H2 id="leaderboard">Leaderboard</H2>
          <p>
            <code>GET /leaderboard?period=30d</code> returns the top 100
            addresses by (a) cumulative subscribed USDG, (b) realized PnL
            since fulfillment, and (c) accrued $RPO from buybacks.
          </p>

          <H2 id="webhooks">Webhooks</H2>
          <p>
            Register a webhook to be pinged when a new IPO opens, when a
            vault fulfills, or when a user&apos;s boost changes. Payloads are
            signed with your key&apos;s HMAC secret; verify the{" "}
            <code>X-RPO-Signature</code> header.
          </p>
          <pre>
            <code>{`POST /webhooks
{
  "url": "https://your.app/rpo",
  "events": ["ipo.opened", "vault.fulfilled", "boost.changed"]
}`}</code>
          </pre>

          <H2 id="errors">Errors</H2>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><code>400</code></td><td>Invalid query params — see <code>error.message</code>.</td></tr>
              <tr><td><code>401</code></td><td>Missing or invalid API key.</td></tr>
              <tr><td><code>404</code></td><td>Unknown ticker / vault / address.</td></tr>
              <tr><td><code>429</code></td><td>Rate limit exceeded. Retry with exponential backoff.</td></tr>
              <tr><td><code>503</code></td><td>Indexer lag &gt; 12 blocks. Retry after 5s.</td></tr>
            </tbody>
          </table>
        </Prose>
      </DocLayout>
    </MarketingShell>
  );
}
