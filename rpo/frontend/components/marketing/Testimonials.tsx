import { Section, SectionHeader } from "@/components/ui/Section";

const QUOTES = [
  {
    quote:
      "RPO is the first protocol where the words 'on-chain IPO' actually mean an IPO. Everything else in this space is a synth or a memecoin with an S&P ticker.",
    author: "Ash V.",
    role: "Portfolio manager, Cape Town",
  },
  {
    quote:
      "I subscribed to STRIPE at 3am from Manila. Fill was $84.90 vs. Robinhood's own opening $85.20. There is no comparable product in TradFi for a retail user in my geography.",
    author: "Iona R.",
    role: "Independent trader",
  },
  {
    quote:
      "Loops are the killer feature. Claim dSTRIPE, drop it into Morpho, borrow USDG, subscribe to dKLARNA — all in one transaction. This is what capital efficiency should feel like.",
    author: "Miguel A.",
    role: "DeFi engineer",
  },
];

export function Testimonials() {
  return (
    <Section id="testimonials" className="border-t border-line bg-paper-100">
      <SectionHeader
        eyebrow="From the community"
        title="What early subscribers say."
      />
      <div className="grid md:grid-cols-3 gap-4">
        {QUOTES.map((q, i) => (
          <figure
            key={i}
            className="card-soft p-10 flex flex-col justify-between h-full"
          >
            <blockquote className="font-display text-2xl text-ink-900 leading-snug">
              &ldquo;{q.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-10 pt-6 border-t border-line">
              <div className="text-sm font-medium text-ink-900">{q.author}</div>
              <div className="text-xs text-ink-500 mt-1">{q.role}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
