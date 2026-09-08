"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { LinkButton } from "@/components/ui/Button";
import { ArrowRight, Menu, X } from "@/components/ui/Icons";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { cn } from "@/lib/cn";

const LINKS = [
  { label: "Product", href: "/how-it-works" },
  { label: "IPO Calendar", href: "/app" },
  { label: "Stake", href: "/app/stake" },
  { label: "Security", href: "/security" },
  { label: "Docs", href: "/docs" },
  { label: "About", href: "/about" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

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
          "transition-all duration-300",
          scrolled
            ? "bg-white/80 backdrop-blur-xl border-b border-line"
            : "bg-transparent border-b border-transparent"
        )}
      >
        <div className="container-wide flex items-center justify-between h-16">
          <div className="flex items-center gap-10">
            <Logo />
            <nav className="hidden lg:flex items-center gap-1">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-3 py-2 text-sm text-ink-500 hover:text-ink-900 rounded-full transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <ConnectButton size="sm" variant="secondary" label="Connect" />
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
        <div className="lg:hidden bg-white/95 backdrop-blur-xl border-b border-line">
          <div className="container-wide py-4 flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-3 text-ink-500 hover:text-ink-900 rounded-lg"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
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
