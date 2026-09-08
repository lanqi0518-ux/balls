/**
 * Structured data emitted per page for Google, LLM crawlers, and RSS
 * discovery. Rendered inline as a script tag; no client JS impact.
 */

const ORG = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "RPO",
  legalName: "RPO Labs",
  url: "https://rpo.xyz",
  logo: "https://rpo.xyz/icon.svg",
  sameAs: [
    "https://github.com/lanqi0518-ux/balls",
    "https://twitter.com/rpo_xyz",
    "https://discord.gg/rpo",
  ],
  contactPoint: [
    {
      "@type": "ContactPoint",
      email: "hello@rpo.xyz",
      contactType: "customer support",
    },
    {
      "@type": "ContactPoint",
      email: "security@rpo.xyz",
      contactType: "security",
    },
    {
      "@type": "ContactPoint",
      email: "press@rpo.xyz",
      contactType: "press",
    },
  ],
};

const SOFTWARE = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "RPO Protocol",
  operatingSystem: "Robinhood Chain",
  applicationCategory: "FinanceApplication",
  softwareVersion: "1.0.3",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "128",
  },
};

const SITE_SEARCH = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  url: "https://rpo.xyz",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://rpo.xyz/explorer?q={query}",
    "query-input": "required name=query",
  },
};

export function JsonLd() {
  const blob = [ORG, SOFTWARE, SITE_SEARCH];
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(blob) }}
    />
  );
}
