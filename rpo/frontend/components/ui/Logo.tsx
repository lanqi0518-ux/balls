import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * The RPO Aperture mark.
 *
 * Concept: a black disc (the vault / sealed prospectus) with a wedge cut
 * out of the top-right (aperture opening / IPO listing going live) and a
 * peach dot inside the aperture (the newly-minted Stock Token appearing).
 *
 * — Reads as a single silhouette at 16px.
 * — Peach dot only appears in the color variant; mono variant is pure B/W.
 */
export function LogoMark({
  className,
  variant = "color",
  size,
}: {
  className?: string;
  variant?: "color" | "mono" | "inverse";
  size?: number;
}) {
  const disc = variant === "inverse" ? "#FFFFFF" : "#0A0A0A";
  const wedge = variant === "inverse" ? "#0A0A0A" : "#FFFFFF";
  const showDot = variant === "color";

  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="rpo-dot-peach" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FF6A3D" />
          <stop offset="1" stopColor="#FFA37A" />
        </linearGradient>
      </defs>
      {/* Base disc */}
      <circle cx="20" cy="20" r="18" fill={disc} />
      {/* Aperture wedge (top-right quadrant) */}
      <path
        d="M 20 2 A 18 18 0 0 1 38 20 L 20 20 Z"
        fill={wedge}
      />
      {/* Newly-minted token dot inside the aperture */}
      {showDot && (
        <circle cx="27.5" cy="12.5" r="3" fill="url(#rpo-dot-peach)" />
      )}
    </svg>
  );
}

export function Logo({
  className,
  href = "/",
  tone = "light",
  showWord = true,
}: {
  className?: string;
  href?: string;
  tone?: "light" | "dark";
  showWord?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 font-semibold tracking-tight",
        tone === "dark" ? "text-white" : "text-ink-900",
        className
      )}
      aria-label="RPO home"
    >
      <LogoMark
        className="h-7 w-7"
        variant={tone === "dark" ? "inverse" : "color"}
      />
      {showWord && (
        <span className="text-[17px]" style={{ letterSpacing: "-0.02em" }}>
          RPO
        </span>
      )}
    </Link>
  );
}

/**
 * The large editorial wordmark used in the hero and footer.
 * Uses Fraunces italic with tight letterspacing.
 */
export function Wordmark({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <span
      className={cn(
        "font-display italic leading-none tracking-tight select-none",
        tone === "dark" ? "text-white" : "text-ink-900",
        className
      )}
      style={{ letterSpacing: "-0.05em" }}
    >
      RPO
    </span>
  );
}
