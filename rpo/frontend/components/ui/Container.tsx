import { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "tight" | "wide" | "copy";

export function Container({
  children,
  variant = "wide",
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}) {
  const base =
    variant === "tight"
      ? "container-tight"
      : variant === "copy"
      ? "container-copy"
      : "container-wide";
  return <Tag className={cn(base, className)}>{children}</Tag>;
}
