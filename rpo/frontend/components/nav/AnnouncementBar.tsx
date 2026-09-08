import Link from "next/link";
import { ArrowRight } from "@/components/ui/Icons";

export function AnnouncementBar() {
  return (
    <Link
      href="/blog/mainnet"
      className="group block bg-ink-800/60 border-b border-line hover:bg-ink-800 transition-colors"
    >
      <div className="container-wide h-9 flex items-center justify-center gap-3 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-mint-500 animate-pulse-mint" />
          <span className="text-fg">RPO v1 is live on Robinhood Chain</span>
        </span>
        <span className="hidden sm:inline text-fg-dim">·</span>
        <span className="hidden sm:inline text-fg-muted group-hover:text-fg">
          Read the launch post
        </span>
        <ArrowRight className="h-3 w-3 text-fg-muted group-hover:text-fg transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
