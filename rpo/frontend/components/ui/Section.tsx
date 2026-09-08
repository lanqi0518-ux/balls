import { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Container } from "./Container";

export function Section({
  children,
  className,
  containerVariant = "wide",
  tight,
  id,
}: {
  children: ReactNode;
  className?: string;
  containerVariant?: "tight" | "wide" | "copy" | "none";
  tight?: boolean;
  id?: string;
}) {
  const inner =
    containerVariant === "none" ? (
      <>{children}</>
    ) : (
      <Container variant={containerVariant}>{children}</Container>
    );
  return (
    <section id={id} className={cn(tight ? "section-tight" : "section", className)}>
      {inner}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-3xl mb-14 lg:mb-20",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      {eyebrow && <div className="eyebrow mb-4">{eyebrow}</div>}
      <h2 className="font-display text-display-sm text-fg">{title}</h2>
      {description && (
        <p className="mt-5 text-lg text-fg-muted leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
