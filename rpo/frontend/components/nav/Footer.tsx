import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LogoMark } from "@/components/ui/Logo";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { Twitter, Github, Discord, Book, Mail } from "@/components/ui/Icons";

const COLS = [
  {
    title: "Protocol",
    links: [
      { label: "IPO Calendar", href: "/app" },
      { label: "Positions", href: "/app/positions" },
      { label: "Stake $RPO", href: "/app/stake" },
      { label: "Leaderboard", href: "/app/leaderboard" },
      { label: "Status", href: "/status" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "Whitepaper", href: "/whitepaper" },
      { label: "Tokenomics", href: "/tokenomics" },
      { label: "Governance", href: "/governance" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "REST API", href: "/docs/api" },
      { label: "TypeScript SDK", href: "/docs/sdk" },
      { label: "Contracts", href: "/docs/contracts" },
      { label: "GitHub", href: "https://github.com/lanqi0518-ux/balls", external: true },
    ],
  },
  {
    title: "Security",
    links: [
      { label: "Security", href: "/security" },
      { label: "Audits", href: "/audits" },
      { label: "Bug bounty", href: "/bounty" },
      { label: "Risk disclosure", href: "/legal/risk" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Careers", href: "/careers" },
      { label: "Grants", href: "/grants" },
      { label: "Press", href: "/press" },
      { label: "Brand kit", href: "/brand" },
    ],
  },
];

const SOCIALS = [
  { label: "X / Twitter", href: "https://twitter.com/rpo_xyz", Icon: Twitter },
  { label: "GitHub", href: "https://github.com/lanqi0518-ux/balls", Icon: Github },
  { label: "Discord", href: "https://discord.gg/rpo", Icon: Discord },
  { label: "Docs", href: "/docs", Icon: Book },
  { label: "Contact", href: "mailto:hello@rpo.xyz", Icon: Mail },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-paper-100">
      <Container>
        {/* Newsletter */}
        <div className="border-b border-line py-12 lg:py-16 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="eyebrow mb-3">Stay in the loop</div>
            <h3 className="font-display text-3xl lg:text-4xl text-ink-900">
              One email per protocol update. Never spam.
            </h3>
          </div>
          <div>
            <NewsletterForm />
            <div className="mt-3 text-xs text-ink-500">
              By subscribing you agree to our{" "}
              <Link href="/legal/privacy" className="underline hover:text-ink-900">
                Privacy Policy
              </Link>
              .
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 py-16 lg:py-20">
          <div className="lg:col-span-3">
            <div className="flex items-center gap-2">
              <LogoMark className="h-8 w-8" />
              <span className="font-semibold text-ink-900 text-lg">RPO</span>
            </div>
            <p className="mt-6 text-sm text-ink-500 max-w-sm leading-relaxed">
              The permissionless IPO subscription protocol. Built on
              Robinhood Chain, priced through Rialto propAMM, secured by
              transparent on-chain vaults.
            </p>

            <div className="mt-8 flex items-center gap-2 flex-wrap">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  aria-label={label}
                  className="h-10 w-10 flex items-center justify-center rounded-full border border-line bg-white text-ink-500 hover:text-ink-900 hover:border-line-strong transition-colors"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-9 grid grid-cols-2 md:grid-cols-5 gap-8">
            {COLS.map((c) => (
              <div key={c.title}>
                <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500 mb-5 font-medium">
                  {c.title}
                </div>
                <ul className="space-y-3">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      {l.external ? (
                        <a
                          href={l.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-ink-500 hover:text-ink-900 transition-colors"
                        >
                          {l.label}
                        </a>
                      ) : (
                        <Link
                          href={l.href}
                          className="text-sm text-ink-500 hover:text-ink-900 transition-colors"
                        >
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Giant wordmark */}
        <div className="border-t border-line pt-16 pb-8">
          <div
            className="font-display italic text-ink-900 leading-none tracking-tight"
            style={{
              fontSize: "clamp(6rem, 22vw, 22rem)",
              lineHeight: "0.85",
            }}
          >
            RPO
          </div>
        </div>

        <div className="border-t border-line py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-xs text-ink-500 leading-relaxed max-w-3xl">
            © {new Date().getFullYear()} RPO Labs. Nothing on this site is
            investment advice. Robinhood Stock Tokens are Reg-S debt securities
            issued by Robinhood Assets (Jersey) Limited and are not offered or
            sold to U.S. persons, Canadians, U.K., Swiss, or U.A.E. residents.
          </div>
          <div className="flex items-center gap-5 text-xs text-ink-500 flex-wrap">
            <Link href="/legal" className="hover:text-ink-900">Legal</Link>
            <Link href="/legal/privacy" className="hover:text-ink-900">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-ink-900">Terms</Link>
            <Link href="/legal/risk" className="hover:text-ink-900">Risk</Link>
            <Link href="/status" className="hover:text-ink-900 inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-forest-500" />
              All systems operational
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
