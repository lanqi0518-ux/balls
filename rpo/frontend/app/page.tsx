import { MarketingNav } from "@/components/nav/MarketingNav";
import { AnnouncementBar } from "@/components/nav/AnnouncementBar";
import { Footer } from "@/components/nav/Footer";
import { Hero } from "@/components/marketing/Hero";
import { StatsBar } from "@/components/marketing/StatsBar";
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

// Revalidate live on-chain reads every 60 seconds so first-paint
// always shows current Chainlink marks without hammering the RPC.
export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      <AnnouncementBar />
      <MarketingNav />
      <main>
        <Hero />
        <StatsBar />
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
