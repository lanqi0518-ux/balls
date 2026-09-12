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
  tone = "light",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
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
      {eyebrow && (
        <div className={tone === "dark" ? "eyebrow-dark mb-5" : "eyebrow mb-5"}>
          {eyebrow}
        </div>
      )}
      <h2
        className={cn(
          "font-display text-display-sm",
          tone === "dark" ? "text-white" : "text-ink-900"
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-6 text-lg leading-relaxed",
            tone === "dark" ? "text-white/70" : "text-ink-500"
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
