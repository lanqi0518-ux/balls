/**
 * Release metadata shown in the footer.
 *
 * Pre-launch state: version is 0.x, nothing is on mainnet.
 * When contracts deploy and the frontend cuts a real release,
 * wire real values from CI (git SHA, tag, timestamp).
 */

export const RELEASE = {
  version: "v0.1.0-pre",
  channel: "pre-launch",
  releasedAt: null as string | null,
  /** Populated by CI when a real release is cut. Empty pre-launch. */
  commit: "" as string,
} as const;

/**
 * The whitepaper is a draft until the protocol is live. There is no
 * PDF hosted yet — the /whitepaper route renders the current draft
 * from the repo directly.
 */
export const WHITEPAPER = {
  version: "draft",
  releasedAt: null as string | null,
  pdfUrl: null as string | null,
  ipfsCid: null as string | null,
  sha256: null as string | null,
} as const;
