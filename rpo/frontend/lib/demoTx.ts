/**
 * Fake tx-hash generator that prefixes every hash with `0xdemo` so the
 * user (and any block-explorer link built from it) instantly recognises
 * that no real on-chain transaction was submitted.
 *
 * Format:
 *   0xdemo<58 hex chars>
 *   ^^^^^^—— identifiable-at-a-glance prefix
 *
 * The 5-char prefix keeps the total length at the canonical 66 chars
 * (0x + 64 hex) so anything that byte-checks the format still passes.
 */
export function demoHash(): string {
  const chars = "0123456789abcdef";
  let rest = "";
  for (let i = 0; i < 60; i++) rest += chars[Math.floor(Math.random() * 16)];
  return "0xdemo" + rest;
}

/** Short-form for display: `0xdemo…f00d` */
export function shortDemoHash(hash: string): string {
  if (hash.length < 12) return hash;
  return hash.slice(0, 6) + "…" + hash.slice(-4);
}
