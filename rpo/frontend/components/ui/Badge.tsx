import { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "mint" | "cream" | "warn";

const variants: Record<Variant, string> = {
  default: "border-line text-fg-muted bg-ink-800/50",
  mint: "border-mint-500/30 text-mint-400 bg-mint-500/10",
  cream: "border-cream/20 text-cream bg-cream/5",
  warn: "border-amber-500/30 text-amber-400 bg-amber-500/10",
};

export function Badge({
  children,
  variant = "default",
  className,
  dot,
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        variants[variant],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "mint" ? "bg-mint-500 animate-pulse-mint" : "bg-current"
          )}
        />
      )}
      {children}
    </span>
  );
}
