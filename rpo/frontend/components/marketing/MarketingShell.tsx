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
    <section className="relative overflow-hidden pt-20 lg:pt-28 pb-16 lg:pb-24 border-b border-line">
      <div className="absolute inset-0 bg-mesh-cool opacity-90 pointer-events-none" />
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="container-wide relative">
        {eyebrow && <div className="eyebrow mb-6">{eyebrow}</div>}
        <h1 className="font-display text-display-md text-ink-900 max-w-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-6 text-lg text-ink-500 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </section>
  );
}
