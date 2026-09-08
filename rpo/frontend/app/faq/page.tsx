import { Metadata } from "next";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { FAQ } from "@/components/marketing/FAQ";
import { CTA } from "@/components/marketing/CTA";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Questions people actually ask about RPO.",
};

export default function FAQPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="FAQ"
        title="Everything you were about to ask."
      />
      <FAQ />
      <CTA />
    </MarketingShell>
  );
}
