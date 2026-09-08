import type { MetadataRoute } from "next";

const BASE = "https://rpo.xyz";

const ROUTES = [
  "",
  "/how-it-works",
  "/security",
  "/legal",
  "/faq",
  "/about",
  "/docs",
  "/blog/mainnet",
  "/app",
  "/app/positions",
  "/app/stake",
  "/app/leaderboard",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((r) => ({
    url: `${BASE}${r}`,
    lastModified: now,
    changeFrequency: r.startsWith("/app") ? "always" : "weekly",
    priority: r === "" ? 1 : 0.7,
  }));
}
