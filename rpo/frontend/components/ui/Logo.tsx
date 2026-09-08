import Link from "next/link";
import { cn } from "@/lib/cn";

export function Logo({
  className,
  href = "/",
  tone = "light",
}: {
  className?: string;
  href?: string;
  tone?: "light" | "dark";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight",
        tone === "dark" ? "text-white" : "text-ink-900",
        className
      )}
      aria-label="RPO home"
    >
      <LogoMark className="h-7 w-7" />
      <span className="text-[17px]">RPO</span>
    </Link>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="lg-mark" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#0A0A0A" />
          <stop offset="1" stopColor="#3A3B41" />
        </linearGradient>
        <radialGradient id="lg-glow" cx="0.7" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#FF6A3D" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FF6A3D" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="10" fill="url(#lg-mark)" />
      <rect x="1" y="1" width="30" height="30" rx="10" fill="url(#lg-glow)" />
      <path
        d="M11 22V10h5.8c2.3 0 4 1.4 4 3.7 0 1.7-1 3-2.5 3.5L21.5 22h-2.9l-2.7-4.4H13.5V22H11zm2.5-6.6h3.1c1.2 0 1.9-.6 1.9-1.7 0-1-.7-1.6-1.9-1.6h-3.1v3.3z"
        fill="#FBF6E9"
      />
    </svg>
  );
}
