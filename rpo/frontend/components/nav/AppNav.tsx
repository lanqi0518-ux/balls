"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { CommandPalette } from "@/components/app/CommandPalette";
import { NotificationCenter } from "@/components/app/NotificationCenter";
import {
  Calendar,
  Wallet,
  Coin,
  Trophy,
  Book,
  Bolt,
  ArrowUpRight,
} from "@/components/ui/Icons";
import { cn } from "@/lib/cn";

const NAV = [
  { label: "Markets", href: "/app", Icon: Calendar },
  { label: "Positions", href: "/app/positions", Icon: Wallet },
  { label: "Stake $RPO", href: "/app/stake", Icon: Coin },
  { label: "Leaderboard", href: "/app/leaderboard", Icon: Trophy },
  { label: "Testnet Faucet", href: "/faucet", Icon: Bolt },
];

const BOTTOM = [
  { label: "Docs", href: "/docs", Icon: Book, external: false },
  {
    label: "GitHub",
    href: "https://github.com/lanqi0518-ux/balls",
    Icon: ArrowUpRight,
    external: true,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:flex flex-col w-60 border-r border-line bg-paper-100 h-screen sticky top-0">
      <div className="h-16 flex items-center px-6 border-b border-line">
        <Logo />
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ label, href, Icon }) => {
          const active =
            href === "/app" ? pathname === "/app" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors",
                active
                  ? "bg-white text-ink-900 shadow-soft border border-line"
                  : "text-ink-500 hover:text-ink-900 hover:bg-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-line space-y-1">
        {BOTTOM.map(({ label, href, Icon, external }) =>
          external ? (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-ink-500 hover:text-ink-900 hover:bg-white transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </a>
          ) : (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-ink-500 hover:text-ink-900 hover:bg-white transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        )}
      </div>
    </aside>
  );
}

export function AppTopBar() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-30 h-16 border-b border-line bg-white">
      <div className="h-full flex items-center justify-between px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="lg:hidden">
            <Logo />
          </Link>
          <div className="hidden lg:block text-sm text-ink-500 font-mono">
            {breadcrumb(pathname)}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <CommandPalette />
          <NotificationCenter />
          <div className="hidden sm:block h-4 w-px bg-line" />
          <ConnectButton size="sm" variant="primary" />
        </div>
      </div>

      <MobileTabs pathname={pathname} />
    </div>
  );
}

function MobileTabs({ pathname }: { pathname: string }) {
  return (
    <div className="lg:hidden border-t border-line flex overflow-x-auto no-scrollbar bg-white">
      {NAV.map(({ label, href, Icon }) => {
        const active =
          href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-xs whitespace-nowrap border-b-2 transition-colors",
              active
                ? "border-ink-900 text-ink-900"
                : "border-transparent text-ink-500"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

function breadcrumb(pathname: string): string {
  if (pathname === "/app") return "app / markets";
  if (pathname.startsWith("/app/markets/")) {
    const t = pathname.split("/").pop() ?? "";
    return `app / markets / ${t.toUpperCase()}`;
  }
  const parts = pathname.split("/").filter(Boolean);
  return parts.join(" / ");
}
