"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export type TocItem = { id: string; label: string; depth?: 2 | 3 };

/**
 * Two-column doc layout: sticky sidebar TOC + main article.
 * Highlights the currently-visible heading using IntersectionObserver.
 */
export function DocLayout({
  meta,
  toc,
  breadcrumbs,
  children,
  version = "v1.0",
}: {
  meta: {
    eyebrow: string;
    title: string;
    subtitle?: string;
    updated?: string;
  };
  toc: TocItem[];
  breadcrumbs?: { label: string; href?: string }[];
  children: ReactNode;
  version?: string;
}) {
  const [active, setActive] = useState<string | null>(toc[0]?.id ?? null);

  useEffect(() => {
    const els = toc
      .map((t) => document.getElementById(t.id))
      .filter((x): x is HTMLElement => !!x);
    if (els.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActive((e.target as HTMLElement).id);
            break;
          }
        }
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0.01 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [toc]);

  return (
    <>
      {/* Header band */}
      <section className="border-b border-line bg-paper-100">
        <div className="container-wide py-16 lg:py-20">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-ink-500 mb-6 font-mono">
              {breadcrumbs.map((b, i) => (
                <span key={i} className="flex items-center gap-2">
                  {b.href ? (
                    <Link href={b.href} className="hover:text-ink-900">
                      {b.label}
                    </Link>
                  ) : (
                    <span>{b.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 && (
                    <span className="text-ink-300">/</span>
                  )}
                </span>
              ))}
            </div>
          )}
          <div className="eyebrow mb-4">{meta.eyebrow}</div>
          <h1 className="font-display text-4xl lg:text-6xl text-ink-900 tracking-tight max-w-4xl">
            {meta.title}
          </h1>
          {meta.subtitle && (
            <p className="mt-6 text-lg text-ink-500 max-w-2xl leading-relaxed">
              {meta.subtitle}
            </p>
          )}
          <div className="mt-8 flex items-center gap-4 text-xs text-ink-500 font-mono">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-forest-500" />
              {version}
            </span>
            {meta.updated && (
              <>
                <span className="text-ink-300">·</span>
                <span>Last updated {meta.updated}</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="py-16 lg:py-24">
        <div className="container-wide grid lg:grid-cols-[240px_1fr_220px] gap-10">
          {/* left rail: not used yet, could add doc navigation later */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-8">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500 mb-4 font-medium">
                  Navigate
                </div>
                <nav className="space-y-1.5 text-sm">
                  {DOC_LINKS.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="block text-ink-500 hover:text-ink-900 py-1"
                    >
                      {l.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </aside>

          {/* main content */}
          <article className="min-w-0">{children}</article>

          {/* right rail: on-page TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500 mb-4 font-medium">
                On this page
              </div>
              <ul className="space-y-2 text-sm">
                {toc.map((t) => (
                  <li key={t.id} className={t.depth === 3 ? "pl-3" : ""}>
                    <a
                      href={`#${t.id}`}
                      className={cn(
                        "block py-1 transition-colors border-l-2 pl-3 -ml-[2px]",
                        active === t.id
                          ? "border-ink-900 text-ink-900 font-medium"
                          : "border-transparent text-ink-500 hover:text-ink-900 hover:border-line-strong"
                      )}
                    >
                      {t.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

const DOC_LINKS = [
  { label: "Whitepaper", href: "/whitepaper" },
  { label: "Docs overview", href: "/docs" },
  { label: "Contracts reference", href: "/docs/contracts" },
  { label: "REST API", href: "/docs/api" },
  { label: "TypeScript SDK", href: "/docs/sdk" },
  { label: "Tokenomics", href: "/tokenomics" },
  { label: "Governance", href: "/governance" },
  { label: "Security", href: "/security" },
  { label: "Audits", href: "/audits" },
  { label: "Bug bounty", href: "/bounty" },
  { label: "Brand kit", href: "/brand" },
];
