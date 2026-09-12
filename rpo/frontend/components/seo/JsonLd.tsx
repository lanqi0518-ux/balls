/**
 * Minimal structured data. Pre-launch, we only expose the org
 * name and the one real link (GitHub). No fake socials, no fake
 * aggregate rating, no fake contact points.
 */

const ORG = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "RPO",
  url: "https://rpo.xyz",
  logo: "https://rpo.xyz/icon.svg",
  sameAs: ["https://github.com/lanqi0518-ux/balls"],
};

export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG) }}
    />
  );
}
