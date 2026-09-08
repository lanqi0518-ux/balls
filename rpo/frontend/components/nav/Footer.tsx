import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LogoMark } from "@/components/ui/Logo";
import { Twitter, Github, Discord, Book } from "@/components/ui/Icons";

const COLS = [
  {
    title: "Protocol",
    links: [
      { label: "IPO Calendar", href: "/app" },
      { label: "Positions", href: "/app/positions" },
      { label: "Stake $RPO", href: "/app/stake" },
      { label: "Leaderboard", href: "/app/leaderboard" },
    ],
  },
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "Security", href: "/security" },
      { label: "FAQ", href: "/faq" },
      { label: "Roadmap", href: "/about#roadmap" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "GitHub", href: "https://github.com/lanqi0518-ux/balls", external: true },
      { label: "Contracts", href: "/docs#contracts" },
      { label: "Audit report", href: "/security#audits" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/about#careers" },
      { label: "Brand kit", href: "/about#brand" },
      { label: "Contact", href: "mailto:hello@rpo.xyz", external: true },
    ],
  },
];

const SOCIALS = [
  { label: "X / Twitter", href: "https://twitter.com/rpo_xyz", Icon: Twitter },
  { label: "GitHub", href: "https://github.com/lanqi0518-ux/balls", Icon: Github },
  { label: "Discord", href: "https://discord.gg/rpo", Icon: Discord },
  { label: "Docs", href: "/docs", Icon: Book },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-ink-900">
      <Container>
        <div className="grid lg:grid-cols-12 gap-10 py-16 lg:py-20">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2">
              <LogoMark className="h-7 w-7" />
              <span className="font-semibold text-fg text-lg">RPO</span>
            </div>
            <p className="mt-5 text-sm text-fg-muted max-w-sm leading-relaxed">
              The permissionless IPO subscription protocol. Built on
              Robinhood Chain, priced through Rialto propAMM, secured by
              transparent on-chain vaults.
            </p>

            <div className="mt-6 flex items-center gap-2">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  aria-label={label}
                  className="h-9 w-9 flex items-center justify-center rounded-full border border-line text-fg-muted hover:text-fg hover:border-line-strong transition-colors"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-8">
            {COLS.map((c) => (
              <div key={c.title}>
                <div className="text-xs uppercase tracking-[0.14em] text-fg-dim mb-4">
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
                          className="text-sm text-fg-muted hover:text-fg transition-colors"
                        >
                          {l.label}
                        </a>
                      ) : (
                        <Link
                          href={l.href}
                          className="text-sm text-fg-muted hover:text-fg transition-colors"
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

        <div className="border-t border-line py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-xs text-fg-dim leading-relaxed max-w-3xl">
            © {new Date().getFullYear()} RPO Labs. Nothing on this site is
            investment advice. Robinhood Stock Tokens are Reg-S debt securities
            issued by Robinhood Assets (Jersey) Limited and are not offered or
            sold to U.S. persons, Canadians, U.K., Swiss, or U.A.E. residents.
            RPO is a self-custodial protocol; you interact with smart contracts
            at your own risk.
          </div>
          <div className="flex items-center gap-5 text-xs text-fg-dim">
            <Link href="/legal" className="hover:text-fg">
              Legal
            </Link>
            <Link href="/legal#privacy" className="hover:text-fg">
              Privacy
            </Link>
            <Link href="/legal#terms" className="hover:text-fg">
              Terms
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
