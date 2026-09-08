import Link from "next/link";
import { cn } from "@/lib/cn";

export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 text-fg font-semibold tracking-tight",
        className
      )}
      aria-label="RPO home"
    >
      <LogoMark className="h-6 w-6" />
      <span className="text-[17px]">RPO</span>
    </Link>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-mint-500", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="lg-mark" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#00E38F" />
          <stop offset="1" stopColor="#3EEFAF" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#lg-mark)" />
      <path
        d="M11 22V10h5.8c2.3 0 4 1.4 4 3.7 0 1.7-1 3-2.5 3.5L21.5 22h-2.9l-2.7-4.4H13.5V22H11zm2.5-6.6h3.1c1.2 0 1.9-.6 1.9-1.7 0-1-.7-1.6-1.9-1.6h-3.1v3.3z"
        fill="#08090B"
      />
    </svg>
  );
}
