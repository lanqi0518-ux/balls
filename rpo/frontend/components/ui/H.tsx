import { ReactNode } from "react";

/**
 * Anchored heading helpers so section links from the on-page TOC scroll
 * to a stable id that also works as a shareable URL fragment.
 */
export function H2({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id}>{children}</h2>;
}

export function H3({ id, children }: { id: string; children: ReactNode }) {
  return <h3 id={id}>{children}</h3>;
}
