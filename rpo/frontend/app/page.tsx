import { MarketingNav } from "@/components/nav/MarketingNav";
import { AnnouncementBar } from "@/components/nav/AnnouncementBar";
import { Footer } from "@/components/nav/Footer";
import { Hero } from "@/components/marketing/Hero";
import { StatsBar } from "@/components/marketing/StatsBar";
import { FivePillars } from "@/components/marketing/FivePillars";
import { Features } from "@/components/marketing/Features";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { GlobalIpoCalendar } from "@/components/marketing/GlobalIpoCalendar";
import { FeaturedIPOs } from "@/components/marketing/FeaturedIPOs";
import { StackDiagram } from "@/components/marketing/StackDiagram";
import { RPOTokenSection } from "@/components/marketing/RPOTokenSection";
import { RoadmapTease } from "@/components/marketing/RoadmapTease";
import { DealFlow } from "@/components/marketing/DealFlow";
import { Partners } from "@/components/marketing/Partners";
import { FAQ } from "@/components/marketing/FAQ";
import { CTA } from "@/components/marketing/CTA";

// Force server-side rendering on every request instead of static
// generation. The Hero + StatsBar + FeaturedIPOs + GlobalIpoCalendar
// each hit external services (Robinhood Chain RPC, Nasdaq, SEC EDGAR),
// which regularly exceed Next.js's default 120s static-generation
// budget. Runtime SSR + edge caching (via revalidate=60 on the fetch
// layer inside those components) gives us the same UX with a
// reliable build.
export const dynamic = "force-dynamic";
export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      <AnnouncementBar />
      <MarketingNav />
      <main>
        <Hero />
        <StatsBar />
        <FivePillars />
        <GlobalIpoCalendar />
        <FeaturedIPOs />
        <Partners />
        <DealFlow />
        <Features />
        <HowItWorks />
        <StackDiagram />
        <RPOTokenSection />
        <RoadmapTease />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
