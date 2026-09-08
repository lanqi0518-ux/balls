"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Wallet,
  Coin,
  Trophy,
  Book,
  Shield,
  Bolt,
  Chart,
  Layers,
  ArrowUpRight,
} from "@/components/ui/Icons";
import { IPO_SEEDS } from "@/lib/demoStore";
import { cn } from "@/lib/cn";

type Command = {
  id: string;
  label: string;
  hint?: string;
  section: string;
  Icon?: (p: { className?: string }) => JSX.Element;
  action: () => void;
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQ("");
        setActive(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commands: Command[] = useMemo(() => {
    const nav: Command[] = [
      { id: "nav-calendar", label: "IPO calendar", section: "Navigate", Icon: Calendar, action: () => router.push("/app") },
      { id: "nav-pos", label: "Positions", section: "Navigate", Icon: Wallet, action: () => router.push("/app/positions") },
      { id: "nav-stake", label: "Stake $RPO", section: "Navigate", Icon: Coin, action: () => router.push("/app/stake") },
      { id: "nav-lb", label: "Leaderboard", section: "Navigate", Icon: Trophy, action: () => router.push("/app/leaderboard") },
      { id: "nav-docs", label: "Docs", section: "Navigate", Icon: Book, action: () => router.push("/docs") },
      { id: "nav-wp", label: "Whitepaper", section: "Navigate", Icon: Book, action: () => router.push("/whitepaper") },
      { id: "nav-rm", label: "Roadmap · NASDAQ replacement plan", section: "Navigate", Icon: Chart, action: () => router.push("/roadmap") },
      { id: "nav-tk", label: "Tokenomics", section: "Navigate", Icon: Coin, action: () => router.push("/tokenomics") },
      { id: "nav-gv", label: "Governance", section: "Navigate", Icon: Shield, action: () => router.push("/governance") },
      { id: "nav-sec", label: "Security", section: "Navigate", Icon: Shield, action: () => router.push("/security") },
      { id: "nav-audits", label: "Audits", section: "Navigate", Icon: Shield, action: () => router.push("/audits") },
      { id: "nav-bounty", label: "Bug bounty", section: "Navigate", Icon: Shield, action: () => router.push("/bounty") },
      { id: "nav-status", label: "Status", section: "Navigate", Icon: Bolt, action: () => router.push("/status") },
      { id: "nav-eco", label: "Ecosystem", section: "Navigate", Icon: Layers, action: () => router.push("/ecosystem") },
      { id: "nav-chg", label: "Changelog", section: "Navigate", Icon: Book, action: () => router.push("/changelog") },
      { id: "nav-exp", label: "Explorer", section: "Navigate", Icon: Chart, action: () => router.push("/explorer") },
      { id: "nav-brand", label: "Brand kit", section: "Navigate", Icon: Book, action: () => router.push("/brand") },
      { id: "nav-careers", label: "Careers", section: "Navigate", Icon: ArrowUpRight, action: () => router.push("/careers") },
      { id: "nav-grants", label: "Grants", section: "Navigate", Icon: ArrowUpRight, action: () => router.push("/grants") },
      { id: "nav-press", label: "Press", section: "Navigate", Icon: ArrowUpRight, action: () => router.push("/press") },
    ];
    const ipos: Command[] = IPO_SEEDS.map((s) => ({
      id: `ipo-${s.ticker}`,
      label: `${s.ticker} — ${s.name}`,
      hint: s.status,
      section: "IPOs",
      action: () => router.push(`/app/ipo/${s.ticker.toLowerCase()}`),
    }));
    return [...nav, ...ipos];
  }, [router]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(query) ||
        c.section.toLowerCase().includes(query)
    );
  }, [q, commands]);

  useEffect(() => setActive(0), [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[active];
      if (cmd) {
        cmd.action();
        setOpen(false);
      }
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-full border border-line bg-white hover:bg-paper-100 text-ink-500 hover:text-ink-900 transition-colors text-xs"
        aria-label="Open command palette"
      >
        <span>Search</span>
        <span className="ml-1 flex items-center gap-0.5">
          <kbd className="kbd">⌘</kbd>
          <kbd className="kbd">K</kbd>
        </span>
      </button>
    );
  }

  // Group by section for display
  let currentSection = "";

  return (
    <>
      <div
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-[60]"
        onClick={() => setOpen(false)}
      />
      <div className="fixed left-1/2 top-24 -translate-x-1/2 w-[560px] max-w-[calc(100vw-2rem)] z-[70]">
        <div className="card-floating overflow-hidden">
          <div className="border-b border-line px-4 flex items-center gap-3 h-14">
            <span className="text-ink-500">⌘</span>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
              placeholder="Search pages, IPOs, addresses..."
              className="flex-1 bg-transparent outline-none text-ink-900 text-sm placeholder:text-ink-400"
            />
            <span className="text-[10px] text-ink-500 font-mono">ESC</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-ink-500">
                No matches.
              </div>
            ) : (
              filtered.map((cmd, i) => {
                const sectionChanged = cmd.section !== currentSection;
                currentSection = cmd.section;
                return (
                  <div key={cmd.id}>
                    {sectionChanged && (
                      <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
                        {cmd.section}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        cmd.action();
                        setOpen(false);
                      }}
                      onMouseEnter={() => setActive(i)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                        active === i
                          ? "bg-paper-100 text-ink-900"
                          : "text-ink-500 hover:bg-paper-100 hover:text-ink-900"
                      )}
                    >
                      {cmd.Icon && (
                        <cmd.Icon className="h-4 w-4 text-ink-500 flex-shrink-0" />
                      )}
                      <span className="flex-1 truncate">{cmd.label}</span>
                      {cmd.hint && (
                        <span className="text-[10px] font-mono text-ink-500">
                          {cmd.hint}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <div className="border-t border-line px-4 py-2 flex items-center justify-between text-[10px] font-mono text-ink-500">
            <span>{filtered.length} results</span>
            <div className="flex items-center gap-3">
              <span>
                <kbd className="kbd">↑↓</kbd> navigate
              </span>
              <span>
                <kbd className="kbd">↵</kbd> open
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
