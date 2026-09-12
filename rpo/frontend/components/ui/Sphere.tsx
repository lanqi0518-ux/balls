import { cn } from "@/lib/cn";

/**
 * A luxurious 3D "glass orb" rendered in pure SVG.
 * Two vertical highlights + a base shadow give it the marble-ball feel used
 * on Framer / Linear hero pages.
 */
export function Sphere({
  className,
  variant = "peach",
  size = 320,
}: {
  className?: string;
  variant?: "peach" | "forest" | "cream" | "ink";
  size?: number;
}) {
  const gradients = {
    peach: {
      base: "#FFC6A9",
      mid: "#FF7F4D",
      deep: "#B33818",
      glow: "#FFE3D4",
    },
    forest: {
      base: "#6EAF83",
      mid: "#0B4D3E",
      deep: "#04201A",
      glow: "#D4E6DA",
    },
    cream: {
      base: "#FFFFFF",
      mid: "#F5F3EC",
      deep: "#D8D9DD",
      glow: "#FFFFFF",
    },
    ink: {
      base: "#3A3B41",
      mid: "#0A0A0A",
      deep: "#050505",
      glow: "#8A8D93",
    },
  }[variant];

  const id = variant + "-orb";

  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      className={cn("select-none pointer-events-none", className)}
      aria-hidden
    >
      <defs>
        <radialGradient id={`${id}-body`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor={gradients.glow} />
          <stop offset="0.3" stopColor={gradients.base} />
          <stop offset="0.75" stopColor={gradients.mid} />
          <stop offset="1" stopColor={gradients.deep} />
        </radialGradient>
        <radialGradient id={`${id}-hi`} cx="0.35" cy="0.2" r="0.35">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-rim`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.85" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor={gradients.deep} stopOpacity="0.35" />
        </radialGradient>
        <filter id={`${id}-shadow`} x="-50%" y="-20%" width="200%" height="140%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      {/* ground shadow */}
      <ellipse
        cx="200"
        cy="360"
        rx="140"
        ry="16"
        fill={gradients.deep}
        opacity="0.35"
        filter={`url(#${id}-shadow)`}
      />
      {/* body */}
      <circle cx="200" cy="200" r="170" fill={`url(#${id}-body)`} />
      {/* rim darken */}
      <circle cx="200" cy="200" r="170" fill={`url(#${id}-rim)`} />
      {/* main highlight */}
      <ellipse cx="150" cy="130" rx="70" ry="45" fill={`url(#${id}-hi)`} />
      {/* soft bottom bounce */}
      <ellipse
        cx="240"
        cy="290"
        rx="60"
        ry="18"
        fill="#FFFFFF"
        opacity="0.10"
      />
    </svg>
  );
}
