/**
 * Release metadata shown in the footer, /changelog, and doc-page
 * headers. Wire these values to your CI at build time; the defaults
 * below mirror the current on-chain deployment.
 */
export const RELEASE = {
  version: "v1.0.3",
  commit: "4a8c2f9",
  releasedAt: "2026-03-08",
  channel: "mainnet",
  builtBy: "gha-runner-9812",
} as const;

export const WHITEPAPER = {
  version: "v1.0",
  releasedAt: "2026-03-01",
  pdfUrl: "https://rpo.xyz/downloads/rpo-whitepaper-v1.0.pdf",
  ipfsCid: "bafybeigd2fplk7czrn2y7q4a6ldk9lqm7xj3yebq3lqfd4vyagfwn6f4qy",
  sha256:
    "d0c4a91e2fbb6a4b73de1e2b83b16b6b8c8bbc4a5a56d9e4c3b0e0f18a37c9d1",
} as const;
