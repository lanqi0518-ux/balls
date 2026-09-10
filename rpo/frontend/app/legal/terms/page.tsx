import { MarketingShell } from "@/components/marketing/MarketingShell";
import { DocLayout, TocItem } from "@/components/docs/DocLayout";
import { Prose } from "@/components/ui/Prose";
import { H2 } from "@/components/ui/H";

export const metadata = { title: "Terms of Service" };

const toc: TocItem[] = [
  { id: "acceptance", label: "1. Acceptance" },
  { id: "eligibility", label: "2. Eligibility" },
  { id: "service", label: "3. Nature of the service" },
  { id: "no-advice", label: "4. Not investment advice" },
  { id: "accounts", label: "5. Wallets & accounts" },
  { id: "prohibited", label: "6. Prohibited conduct" },
  { id: "ip", label: "7. Intellectual property" },
  { id: "warranty", label: "8. No warranty" },
  { id: "liability", label: "9. Limitation of liability" },
  { id: "indemnity", label: "10. Indemnity" },
  { id: "law", label: "11. Governing law" },
  { id: "changes", label: "12. Changes" },
  { id: "contact", label: "13. Contact" },
];

export default function TermsPage() {
  return (
    <MarketingShell>
      <DocLayout
        meta={{
          eyebrow: "Legal",
          title: "Terms of Service",
          subtitle:
            "These Terms govern your use of the RPO website, API, SDK, and any interface operated by RPO Labs. They do not govern the RPO smart contracts themselves, which are autonomous.",
          updated: "Draft",
        }}
        toc={toc}
        breadcrumbs={[
          { label: "legal", href: "/legal" },
          { label: "terms" },
        ]}
      >
        <Prose>
          <H2 id="acceptance">1. Acceptance</H2>
          <p>
            By connecting a wallet, calling the API, importing the SDK, or
            otherwise accessing any RPO interface, you agree to be bound by
            these Terms. If you do not agree, do not use the interface. The
            protocol itself is permissionless and its use is not governed
            by any Terms — only your interaction with the interfaces we
            operate is.
          </p>

          <H2 id="eligibility">2. Eligibility</H2>
          <p>
            You must be at least 18 years old and not a resident, citizen,
            or otherwise present in a{" "}
            <strong>Restricted Jurisdiction</strong>. As of the effective
            date, Restricted Jurisdictions include: the United States,
            Canada, the United Kingdom, Switzerland, the United Arab
            Emirates, and any country subject to comprehensive OFAC
            sanctions. You represent that you are not on any sanctions
            list and are not acting on behalf of a sanctioned entity.
          </p>

          <H2 id="service">3. Nature of the service</H2>
          <p>
            RPO Labs operates hosted read/write interfaces to the RPO smart
            contracts. We do not custody user funds. We do not execute
            trades on your behalf. We do not act as broker, dealer,
            investment adviser, exchange, custodian, or money-transmitter.
            Every write path exposed via our interfaces is a plain
            transaction signed by your own wallet against public, audited
            contracts.
          </p>

          <H2 id="no-advice">4. Not investment advice</H2>
          <p>
            Nothing on the interfaces or in our documentation is investment
            advice, tax advice, or a recommendation to buy, sell, or hold
            any asset. Robinhood Stock Tokens are securities. Their prices
            can go up or down. You can lose your entire principal. You are
            solely responsible for your investment decisions and for
            consulting qualified professionals.
          </p>

          <H2 id="accounts">5. Wallets &amp; accounts</H2>
          <p>
            You are the sole custodian of any wallet you use with RPO. If
            you lose your keys, you lose your funds; there is no reset
            mechanism, no support line, and no recovery path. API keys
            issued via the developer dashboard grant read-only access
            unless explicitly upgraded; you are responsible for keeping
            them secret.
          </p>

          <H2 id="prohibited">6. Prohibited conduct</H2>
          <p>You agree not to:</p>
          <ul>
            <li>
              Use the interfaces to violate any applicable law, including
              securities laws in your jurisdiction.
            </li>
            <li>
              Circumvent the geo-block or misrepresent your jurisdiction.
            </li>
            <li>
              Reverse-engineer, decompile, or scrape rate-limited endpoints
              in excess of published limits.
            </li>
            <li>Interfere with, disable, or impair the interfaces.</li>
            <li>Impersonate RPO Labs or any other person or entity.</li>
          </ul>

          <H2 id="ip">7. Intellectual property</H2>
          <p>
            The interfaces, documentation, and branding are © RPO Labs.
            Smart-contract source code is dual-licensed under MIT and
            Apache-2.0 and is <em>not</em> subject to these Terms — see
            the <code>LICENSE</code> file in the repository. The RPO
            wordmark and aperture logomark are trademarks of RPO Labs.
          </p>

          <H2 id="warranty">8. No warranty</H2>
          <p>
            THE INTERFACES ARE PROVIDED &quot;AS IS&quot; WITHOUT WARRANTY
            OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE
            INTERFACES WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF
            HARMFUL COMPONENTS.
          </p>

          <H2 id="liability">9. Limitation of liability</H2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, RPO LABS AND ITS
            AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS WILL
            NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED
            TO YOUR USE OF THE INTERFACES OR THE PROTOCOL, INCLUDING
            LOSS OF PROFITS, DATA, OR TOKENS.
          </p>

          <H2 id="indemnity">10. Indemnity</H2>
          <p>
            You agree to indemnify and hold RPO Labs harmless from any
            claim arising out of your breach of these Terms, your
            violation of law, or your use of the interfaces.
          </p>

          <H2 id="law">11. Governing law</H2>
          <p>
            These Terms are governed by the laws of the{" "}
            <strong>Cayman Islands</strong>, without regard to conflict-of-law
            principles. Any dispute must be submitted to binding arbitration
            in George Town under the CIAC Rules, seated in the Cayman
            Islands.
          </p>

          <H2 id="changes">12. Changes</H2>
          <p>
            We may amend these Terms at any time by publishing an updated
            version. Continued use of the interfaces after the update
            constitutes acceptance. Material changes will be announced 14
            days in advance via the announcement bar.
          </p>

          <H2 id="contact">13. Contact</H2>
          <p>
            Questions about these Terms: open a thread on{" "}
            <a href="https://github.com/lanqi0518-ux/balls/discussions">
              GitHub Discussions
            </a>
            .
          </p>
        </Prose>
      </DocLayout>
    </MarketingShell>
  );
}
