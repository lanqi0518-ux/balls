import { ReactNode } from "react";
import { MarketingNav } from "@/components/nav/MarketingNav";
import { AnnouncementBar } from "@/components/nav/AnnouncementBar";
import { Footer } from "@/components/nav/Footer";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <MarketingNav />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
    </>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden pt-16 lg:pt-24 pb-14 lg:pb-20 border-b border-line">
      <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="container-wide relative">
        {eyebrow && (
          <div className="eyebrow mb-5">{eyebrow}</div>
        )}
        <h1 className="font-display text-display-md text-fg max-w-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-6 text-lg text-fg-muted max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </section>
  );
}
