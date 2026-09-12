import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LogoMark } from "@/components/ui/Logo";
import { Github, Book } from "@/components/ui/Icons";
import { RELEASE } from "@/lib/version";
import { RPO_ADDRESSES } from "@/lib/addresses";

const COLS = [
  {
    title: "Protocol",
    links: [
      { label: "IPO Calendar", href: "/app" },
      { label: "Positions", href: "/app/positions" },
      { label: "Stake $RPO", href: "/app/stake" },
      { label: "Testnet Faucet", href: "/faucet" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "Whitepaper", href: "/whitepaper" },
      { label: "Economics", href: "/economics" },
      { label: "Roadmap", href: "/roadmap" },
      { label: "Tokenomics", href: "/tokenomics" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Contracts", href: "/docs/contracts" },
      {
        label: "GitHub",
        href: "https://github.com/lanqi0518-ux/balls",
        external: true,
      },
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
];

const SOCIALS = [
  {
    label: "GitHub",
    href: "https://github.com/lanqi0518-ux/balls",
    Icon: Github,
  },
  { label: "Docs", href: "/docs", Icon: Book },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-paper-100">
      <Container>
        <div className="grid lg:grid-cols-12 gap-10 py-16 lg:py-20">
          <div className="lg:col-span-3">
            <div className="flex items-center gap-2">
              <LogoMark className="h-8 w-8" />
              <span className="font-semibold text-ink-900 text-lg">RPO</span>
            </div>
            <p className="mt-6 text-sm text-ink-500 max-w-sm leading-relaxed">
              The permissionless IPO subscription protocol. Designed for
              Robinhood Chain. Pre-launch: contracts are drafted in{" "}
              <span className="whitespace-nowrap">rpo/contracts</span> and
              await third-party audit before mainnet deployment.
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

          <div className="lg:col-span-9 grid grid-cols-2 md:grid-cols-4 gap-8">
            {COLS.map((c) => (
              <div key={c.title}>
                <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500 mb-5 font-medium">
                  {c.title}
                </div>
                <ul className="space-y-3">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      {"external" in l && l.external ? (
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
            © {new Date().getFullYear()} RPO. Nothing on this site is
            investment advice. Robinhood Stock Tokens are Reg-S debt securities
            issued by Robinhood Assets (Jersey) Limited and are not offered or
            sold to U.S. persons, Canadians, U.K., Swiss, or U.A.E. residents.
          </div>
          <div className="flex items-center gap-5 text-xs text-ink-500 flex-wrap">
            <Link href="/legal" className="hover:text-ink-900">
              Legal
            </Link>
            <Link href="/legal/privacy" className="hover:text-ink-900">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-ink-900">
              Terms
            </Link>
            <Link href="/legal/risk" className="hover:text-ink-900">
              Risk
            </Link>
            <a
              href="https://github.com/lanqi0518-ux/balls"
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink-900 font-mono inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-2.5 py-1"
              title={`Pre-launch scaffold for chain id ${RPO_ADDRESSES.chainId}`}
            >
              <span className="h-1 w-1 rounded-full bg-peach-500" />
              {RELEASE.version}
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
