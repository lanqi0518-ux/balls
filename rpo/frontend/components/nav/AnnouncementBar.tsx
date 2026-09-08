import Link from "next/link";
import { ArrowRight } from "@/components/ui/Icons";

export function AnnouncementBar() {
  return (
    <Link
      href="/roadmap"
      className="group block bg-ink-900 text-white hover:bg-ink-800 transition-colors"
    >
      <div className="container-wide h-9 flex items-center justify-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-peach-500" />
          <span className="text-white">Roadmap · The plan to replace NASDAQ with on-chain IPOs</span>
        </span>
        <span className="hidden sm:inline text-white/40">·</span>
        <span className="hidden sm:inline text-white/70 group-hover:text-white">
          Read the four-phase plan
        </span>
        <ArrowRight className="h-3 w-3 text-white/70 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
