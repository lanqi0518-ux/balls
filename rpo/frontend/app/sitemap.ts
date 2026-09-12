import type { MetadataRoute } from "next";

const BASE = "https://rpo.xyz";

const ROUTES = [
  // Marketing
  "",
  "/how-it-works",
  "/whitepaper",
  "/economics",
  "/roadmap",
  "/tokenomics",
  "/governance",
  "/about",
  "/faq",
  "/ecosystem",
  "/changelog",
  "/explorer",
  // HOODIPO primitives
  "/vault",
  "/launch",
  "/strategies",
  "/predict",
  "/hedge",
  "/monitor",
  "/ipos",
  // Docs
  "/docs",
  "/docs/api",
  "/docs/sdk",
  "/docs/contracts",
  // Security
  "/security",
  "/audits",
  "/bounty",
  // Legal
  "/legal",
  "/legal/terms",
  "/legal/privacy",
  "/legal/risk",
  // App
  "/app",
  "/app/positions",
  "/app/stake",
  "/app/leaderboard",
  "/faucet",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((r) => ({
    url: `${BASE}${r}`,
    lastModified: now,
    changeFrequency: r.startsWith("/app") ? "always" : "weekly",
    priority:
      r === "" ? 1 : r.startsWith("/docs") || r === "/whitepaper" ? 0.8 : 0.6,
  }));
}
