"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { LinkButton } from "@/components/ui/Button";
import { ArrowRight, ChevronDown, Menu, X } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";

type MenuItem = {
  label: string;
  href: string;
  hint?: string;
};

type Menu = {
  label: string;
  items: MenuItem[];
  cta?: { label: string; href: string; hint: string };
};

const MENUS: Menu[] = [
  {
    label: "Product",
    items: [
      { label: "How it works", href: "/how-it-works", hint: "Protocol tour" },
      { label: "IPO Calendar", href: "/app", hint: "Live subscriptions" },
      { label: "Explorer", href: "/explorer", hint: "Every vault, searchable" },
      { label: "Stake $RPO", href: "/app/stake", hint: "Boost your allocation" },
      { label: "Leaderboard", href: "/app/leaderboard", hint: "Top subscribers" },
      { label: "Status", href: "/status", hint: "Live system health" },
    ],
    cta: {
      label: "Launch app →",
      href: "/app",
      hint: "Connect and subscribe in 20 seconds.",
    },
  },
  {
    label: "Learn",
    items: [
      { label: "Whitepaper", href: "/whitepaper", hint: "12-chapter technical paper" },
      { label: "Roadmap", href: "/roadmap", hint: "The NASDAQ-replacement plan" },
      { label: "Tokenomics", href: "/tokenomics", hint: "Supply, distribution, flywheel" },
      { label: "Governance", href: "/governance", hint: "Proposals & votes" },
      { label: "Ecosystem", href: "/ecosystem", hint: "Every integration + version" },
      { label: "FAQ", href: "/faq", hint: "Common questions" },
      { label: "Blog", href: "/blog", hint: "Latest posts" },
    ],
  },
  {
    label: "Developers",
    items: [
      { label: "Docs overview", href: "/docs", hint: "Start here" },
      { label: "REST API", href: "/docs/api", hint: "Read every state" },
      { label: "TypeScript SDK", href: "/docs/sdk", hint: "@rpo/sdk" },
      { label: "Contract reference", href: "/docs/contracts", hint: "Solidity + gas + storage" },
      { label: "Changelog", href: "/changelog", hint: "Every release, signed" },
      { label: "GitHub", href: "https://github.com/lanqi0518-ux/balls", hint: "Source" },
    ],
  },
  {
    label: "Security",
    items: [
      { label: "Security overview", href: "/security", hint: "Trust-minimization" },
      { label: "Audits", href: "/audits", hint: "Trail of Bits + Spearbit" },
      { label: "Bug bounty", href: "/bounty", hint: "$500k cap" },
      { label: "Risk disclosure", href: "/legal/risk", hint: "Read before subscribing" },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "About", href: "/about", hint: "Team & mission" },
      { label: "Careers", href: "/careers", hint: "6 open roles" },
      { label: "Grants", href: "/grants", hint: "Ecosystem funding" },
      { label: "Press", href: "/press", hint: "Coverage & kit" },
      { label: "Brand", href: "/brand", hint: "Logo & guidelines" },
    ],
  },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sticky top-0 z-50">
      <div
        className={cn(
          "transition-colors duration-200",
          scrolled
            ? "bg-white/95 border-b border-line"
            : "bg-transparent border-b border-transparent"
        )}
      >
        <div className="container-wide flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Logo />
            <nav
              className="hidden lg:flex items-center gap-1"
              onMouseLeave={() => setHover(null)}
            >
              {MENUS.map((m) => (
                <div
                  key={m.label}
                  className="relative"
                  onMouseEnter={() => setHover(m.label)}
                >
                  <button
                    className={cn(
                      "px-3 py-2 text-sm rounded-full transition-colors inline-flex items-center gap-1",
                      hover === m.label
                        ? "text-ink-900 bg-paper-100"
                        : "text-ink-500 hover:text-ink-900"
                    )}
                  >
                    {m.label}
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform",
                        hover === m.label ? "rotate-180" : ""
                      )}
                    />
                  </button>

                  {hover === m.label && (
                    <div className="absolute top-full left-0 pt-2">
                      <div className="card-floating min-w-[320px] p-3">
                        <div className="grid gap-0.5">
                          {m.items.map((it) =>
                            it.href.startsWith("http") ? (
                              <a
                                key={it.href}
                                href={it.href}
                                target="_blank"
                                rel="noreferrer"
                                className="block px-4 py-3 rounded-xl hover:bg-paper-100 transition-colors"
                              >
                                <div className="text-sm font-medium text-ink-900">
                                  {it.label}
                                </div>
                                {it.hint && (
                                  <div className="text-xs text-ink-500 mt-0.5">
                                    {it.hint}
                                  </div>
                                )}
                              </a>
                            ) : (
                              <Link
                                key={it.href}
                                href={it.href}
                                onClick={() => setHover(null)}
                                className="block px-4 py-3 rounded-xl hover:bg-paper-100 transition-colors"
                              >
                                <div className="text-sm font-medium text-ink-900">
                                  {it.label}
                                </div>
                                {it.hint && (
                                  <div className="text-xs text-ink-500 mt-0.5">
                                    {it.hint}
                                  </div>
                                )}
                              </Link>
                            )
                          )}
                        </div>
                        {m.cta && (
                          <Link
                            href={m.cta.href}
                            onClick={() => setHover(null)}
                            className="mt-2 block rounded-xl bg-ink-900 text-white px-4 py-3 hover:bg-ink-800 transition-colors"
                          >
                            <div className="text-sm font-medium">
                              {m.cta.label}
                            </div>
                            <div className="text-xs text-white/70 mt-0.5">
                              {m.cta.hint}
                            </div>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <LinkButton
              href="/docs"
              variant="ghost"
              size="sm"
            >
              Docs
            </LinkButton>
            <LinkButton
              href="/app"
              variant="primary"
              size="sm"
              trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
            >
              Launch app
            </LinkButton>
          </div>

          <button
            className="lg:hidden text-ink-500 p-2"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden bg-white border-b border-line max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="container-wide py-6 space-y-6">
            {MENUS.map((m) => (
              <div key={m.label}>
                <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500 mb-3 font-medium">
                  {m.label}
                </div>
                <div className="space-y-1">
                  {m.items.map((it) => (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2 text-ink-900 rounded-lg hover:bg-paper-100"
                    >
                      {it.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <div className="pt-3">
              <LinkButton href="/app" variant="primary" size="md" fullWidth>
                Launch app
              </LinkButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
