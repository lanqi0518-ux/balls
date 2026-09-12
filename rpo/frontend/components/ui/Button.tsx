import Link from "next/link";
import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "forest" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink-900 hover:bg-ink-800 text-white shadow-soft hover:shadow-card",
  forest:
    "bg-forest-500 hover:bg-forest-600 text-white shadow-soft hover:shadow-card",
  secondary:
    "bg-paper-100 hover:bg-paper-200 text-ink-900 border border-line",
  outline:
    "border border-line-strong hover:border-ink-900 text-ink-900 bg-transparent hover:bg-paper-100",
  ghost: "text-ink-500 hover:text-ink-900 hover:bg-paper-100",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-3.5 py-1.5",
  md: "text-sm px-5 py-2.5",
  lg: "text-base px-6 py-3.5",
};

type Common = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
};

type AsLink = Common & { href: string; external?: boolean };

function baseClass(v: Variant, s: Size, fullWidth?: boolean) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed select-none",
    variants[v],
    sizes[s],
    fullWidth && "w-full"
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & Common
>(function Button(
  {
    variant = "primary",
    size = "md",
    className,
    children,
    leadingIcon,
    trailingIcon,
    fullWidth,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(baseClass(variant, size, fullWidth), className)}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
});

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  children,
  leadingIcon,
  trailingIcon,
  fullWidth,
  href,
  external,
}: AsLink & Common) {
  const cls = cn(baseClass(variant, size, fullWidth), className);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {leadingIcon}
        {children}
        {trailingIcon}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </Link>
  );
}
