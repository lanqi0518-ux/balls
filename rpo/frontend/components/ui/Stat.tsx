import { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Stat({
  label,
  value,
  suffix,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("py-2", className)}>
      <div className="text-xs uppercase tracking-[0.14em] text-fg-dim mb-2">
        {label}
      </div>
      <div className="font-display text-4xl lg:text-5xl text-fg tabular-nums leading-none">
        {value}
        {suffix && (
          <span className="text-fg-muted text-2xl align-top ml-1">
            {suffix}
          </span>
        )}
      </div>
      {hint && <div className="mt-2 text-xs text-fg-dim">{hint}</div>}
    </div>
  );
}
