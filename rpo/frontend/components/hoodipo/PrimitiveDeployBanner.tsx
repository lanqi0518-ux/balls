"use client";

import { CONTRACTS, isDeployed } from "@/lib/chain";

/**
 * Small honest banner reporting whether a HOODIPO primitive is
 * currently deployed. The moment a user or the team deploys the
 * factory and sets the address env var, every /vault, /launch,
 * /strategies, /predict, /hedge page picks it up.
 */
export function PrimitiveDeployBanner({
  primitive,
  address,
  githubPath,
}: {
  primitive: string;
  address: `0x${string}`;
  githubPath: string;
}) {
  const live = isDeployed(address);
  return (
    <div
      className={
        "rounded-2xl border p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 " +
        (live
          ? "bg-forest-50 border-forest-500/30"
          : "bg-peach-100 border-peach-500/30")
      }
    >
      <div className="flex items-center gap-3">
        <span
          className={
            "h-2.5 w-2.5 rounded-full " +
            (live ? "bg-forest-500" : "bg-peach-500 animate-pulse")
          }
        />
        <div>
          <div className="text-sm font-semibold text-ink-900">
            {primitive}
          </div>
          <div className="text-xs text-ink-500 mt-0.5 font-mono">
            {live ? (
              <>
                Deployed at{" "}
                <a
                  href={`https://robinscan.com/address/${address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {address.slice(0, 8)}…{address.slice(-6)}
                </a>{" "}
                on Robinhood Chain
              </>
            ) : (
              "Contract compiled, not yet deployed on RH Chain. Deployment tx will unlock this UI."
            )}
          </div>
        </div>
      </div>
      <div className="sm:ml-auto flex gap-2 text-xs">
        <a
          href={githubPath}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-ink-900 px-3 py-1.5 text-ink-900 hover:bg-ink-900 hover:text-white transition-colors"
        >
          View .sol on GitHub
        </a>
        <span className="rounded-full bg-ink-900 text-white px-3 py-1.5 font-mono">
          USDG {CONTRACTS.usdg.slice(0, 6)}…
        </span>
      </div>
    </div>
  );
}
