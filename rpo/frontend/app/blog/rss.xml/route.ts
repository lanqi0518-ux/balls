import { NextResponse } from "next/server";

const SITE = "https://rpo.xyz";

const POSTS = [
  {
    slug: "morpho-partnership",
    title: "LeverageLooper enters GA with Morpho Blue markets",
    excerpt:
      "Every filled IPO can now be collateralized against USDG on Morpho Blue in one click, and the borrowed USDG can auto-subscribe to the next vault.",
    pubDate: "Sun, 08 Mar 2026 09:00:00 +0000",
    category: "Partnership",
  },
  {
    slug: "boost-mechanism",
    title: "Why the boost curve is a square root",
    excerpt:
      "A short tour of the math and game theory behind AllocationBooster.",
    pubDate: "Fri, 06 Mar 2026 09:00:00 +0000",
    category: "Research",
  },
  {
    slug: "mainnet",
    title: "RPO v1 is live on Robinhood Chain",
    excerpt:
      "The first permissionless IPO subscription protocol goes live with 5 open vaults.",
    pubDate: "Tue, 03 Mar 2026 09:00:00 +0000",
    category: "Launch",
  },
];

/**
 * Blog RSS 2.0 feed. Announced from every changelog release and linked
 * from the footer. Regenerated on deploy — Vercel edge caches for 5m.
 */
export async function GET() {
  const items = POSTS.map(
    (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE}/blog/${p.slug}</link>
      <guid isPermaLink="true">${SITE}/blog/${p.slug}</guid>
      <description>${esc(p.excerpt)}</description>
      <category>${esc(p.category)}</category>
      <pubDate>${p.pubDate}</pubDate>
    </item>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>RPO — protocol updates</title>
    <link>${SITE}/blog</link>
    <description>Product updates, protocol research, and deep dives from RPO Labs.</description>
    <language>en-us</language>
    <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
