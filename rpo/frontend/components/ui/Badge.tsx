import { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "forest" | "peach" | "dark" | "warn";

const variants: Record<Variant, string> = {
  default: "border-line text-ink-500 bg-white",
  forest: "bg-forest-50 border-forest-200 text-forest-500",
  peach: "bg-peach-50 border-peach-200 text-peach-600",
  dark: "bg-ink-900 border-ink-900 text-white",
  warn: "border-amber-300 text-amber-700 bg-amber-50",
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
            variant === "forest"
              ? "bg-forest-500"
              : variant === "peach"
              ? "bg-peach-500"
              : variant === "dark"
              ? "bg-white"
              : "bg-ink-900"
          )}
        />
      )}
      {children}
    </span>
  );
}
