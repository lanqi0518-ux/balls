import { MarketingNav } from "@/components/nav/MarketingNav";
import { AnnouncementBar } from "@/components/nav/AnnouncementBar";
import { Footer } from "@/components/nav/Footer";
import { Hero } from "@/components/marketing/Hero";
import { StatsBar } from "@/components/marketing/StatsBar";
import { Features } from "@/components/marketing/Features";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { FeaturedIPOs } from "@/components/marketing/FeaturedIPOs";
import { StackDiagram } from "@/components/marketing/StackDiagram";
import { RPOTokenSection } from "@/components/marketing/RPOTokenSection";
import { RoadmapTease } from "@/components/marketing/RoadmapTease";
import { DealFlow } from "@/components/marketing/DealFlow";
import { Partners } from "@/components/marketing/Partners";
import { Testimonials } from "@/components/marketing/Testimonials";
import { FAQ } from "@/components/marketing/FAQ";
import { CTA } from "@/components/marketing/CTA";

export default function HomePage() {
  return (
    <>
      <AnnouncementBar />
      <MarketingNav />
      <main>
        <Hero />
        <StatsBar />
        <Partners />
        <DealFlow />
        <Features />
        <HowItWorks />
        <FeaturedIPOs />
        <StackDiagram />
        <RPOTokenSection />
        <RoadmapTease />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
