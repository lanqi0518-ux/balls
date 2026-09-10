import { MarketingShell } from "@/components/marketing/MarketingShell";
import { DocLayout, TocItem } from "@/components/docs/DocLayout";
import { Prose } from "@/components/ui/Prose";
import { H2 } from "@/components/ui/H";

export const metadata = { title: "Privacy Policy" };

const toc: TocItem[] = [
  { id: "principle", label: "Our principle" },
  { id: "collect", label: "What we collect" },
  { id: "not", label: "What we don't collect" },
  { id: "use", label: "How we use it" },
  { id: "share", label: "Who we share with" },
  { id: "retention", label: "Retention" },
  { id: "rights", label: "Your rights" },
  { id: "cookies", label: "Cookies" },
  { id: "children", label: "Children" },
  { id: "contact", label: "Contact" },
];

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <DocLayout
        meta={{
          eyebrow: "Legal",
          title: "Privacy Policy",
          subtitle:
            "RPO Labs collects the minimum data needed to operate the interfaces, protect users, and comply with law. This document is the whole picture.",
          updated: "March 2026",
        }}
        toc={toc}
        breadcrumbs={[
          { label: "legal", href: "/legal" },
          { label: "privacy" },
        ]}
      >
        <Prose>
          <H2 id="principle">Our principle</H2>
          <p>
            We treat every byte of user data as a liability. We collect it
            only when necessary to operate the interfaces, and we retain
            it only as long as legally required.
          </p>

          <H2 id="collect">What we collect</H2>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Data</th>
                <th>Basis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Server logs</td>
                <td>IP, user-agent, request path, response code, latency</td>
                <td>Legitimate interest (abuse prevention)</td>
              </tr>
              <tr>
                <td>Wallet address</td>
                <td>Public wallet address, connected chain</td>
                <td>Necessary to serve you the interface</td>
              </tr>
              <tr>
                <td>Geo-check</td>
                <td>Country code derived from IP at Cloudflare edge</td>
                <td>Compliance with Reg-S restrictions</td>
              </tr>
              <tr>
                <td>API key (optional)</td>
                <td>Email, key hash, monthly usage stats</td>
                <td>Contract performance</td>
              </tr>
              <tr>
                <td>Newsletter (optional)</td>
                <td>Email</td>
                <td>Consent, revocable at any time</td>
              </tr>
            </tbody>
          </table>

          <H2 id="not">What we don&apos;t collect</H2>
          <ul>
            <li>Any KYC data — no ID, no phone, no address.</li>
            <li>Your private keys or seed phrase.</li>
            <li>Any information about your holdings on other protocols.</li>
            <li>
              Cross-site behavioral tracking (no Google Analytics, no
              Facebook Pixel, no third-party session replay).
            </li>
          </ul>

          <H2 id="use">How we use it</H2>
          <ul>
            <li>Serve pages and API responses.</li>
            <li>Rate-limit and block abuse.</li>
            <li>Enforce the geo-block on the subscribe interface.</li>
            <li>Send transactional emails to API-key holders.</li>
            <li>Aggregate anonymous stats for capacity planning.</li>
          </ul>

          <H2 id="share">Who we share with</H2>
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Purpose</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Cloudflare</td><td>Edge network, WAF, geo-detection</td><td>Server logs</td></tr>
              <tr><td>Vercel</td><td>Frontend hosting</td><td>Server logs</td></tr>
              <tr><td>AWS eu-west-2</td><td>API + indexer</td><td>Server logs, API-key metadata</td></tr>
              <tr><td>Resend</td><td>Transactional email</td><td>Email address of API opt-ins (if provided)</td></tr>
            </tbody>
          </table>
          <p>
            We do not sell personal data. Ever. We disclose to regulators
            only under valid legal process.
          </p>

          <H2 id="retention">Retention</H2>
          <p>
            Server logs are retained for 90 days rolling. API-key metadata
            is retained for the life of the key plus 12 months for
            fraud-response. Newsletter emails are retained until you
            unsubscribe. On request, we will delete everything we hold
            about you within 30 days, except records we are legally
            required to retain.
          </p>

          <H2 id="rights">Your rights</H2>
          <p>
            Depending on your jurisdiction, you may have the right to
            access, correct, port, or delete data we hold about you, and
            to object to processing. Contact{" "}
            <a href="mailto:privacy@rpo.xyz">privacy@rpo.xyz</a> to
            exercise any of these rights. We respond within 30 days.
          </p>

          <H2 id="cookies">Cookies</H2>
          <p>
            We set one first-party cookie:{" "}
            <code>rpo-preferences</code>, storing your dark-mode preference
            and dismissed announcement banner. It is not used for tracking
            and never leaves your browser. There are no third-party cookies
            on this site.
          </p>

          <H2 id="children">Children</H2>
          <p>
            The interfaces are not directed at children under 18 and we do
            not knowingly collect any data from them. If we learn we have
            such data, we will delete it.
          </p>

          <H2 id="contact">Contact</H2>
          <p>
            Data-protection questions:{" "}
            <a href="mailto:privacy@rpo.xyz">privacy@rpo.xyz</a>. EU
            residents may lodge complaints with their local DPA.
          </p>
        </Prose>
      </DocLayout>
    </MarketingShell>
  );
}
