import Link from "next/link";
import { Section, SectionHeader } from "@/components/ui/Section";
import { LIVE_BY_SOURCE, TOTAL_LIVE } from "@/lib/catalog";

const PIPES = [
  {
    n: "01",
    tag: "RHJ Reg-S",
    dot: "bg-peach-500",
    live: LIVE_BY_SOURCE["RHJ Reg-S"],
    rate: "depends on RHJ listing cadence",
    body:
      "Every stock token Robinhood adds to its Jersey Reg-S catalog. The keeper polls the endpoint on a short cadence and calls IPORegistry.propose() the moment a new asset appears — the vault opens for subscription within one block. Requires the keeper to be live and the RPO registry to be deployed.",
  },
  {
    n: "02",
    tag: "Aftermarket",
    dot: "bg-forest-500",
    live: LIVE_BY_SOURCE.Aftermarket,
    rate: "one per listed token, always-on",
    body:
      "One always-on subscription vault per Robinhood-listed stock token. Users stream USDG in; the keeper batch-fulfills via Rialto propAMM at oracle-bound pricing on a rolling schedule. Deployed permissionlessly via AssetDiscovery.openAftermarket(token).",
  },
  {
    n: "03",
    tag: "Pons Launchpad",
    dot: "bg-ink-900",
    live: LIVE_BY_SOURCE["Pons Launchpad"],
    rate: "one per Pons graduation",
    body:
      "Every token that graduates from Pons' bonding curve to Uniswap V4 auto-spawns a 72-hour RPO subscription vault. RPO listens to the TokenGraduated event on the Pons factory and calls AssetDiscovery.openPonsGraduation(token) permissionlessly.",
  },
  {
    n: "04",
    tag: "Direct Reg-S / Reg-A+",
    dot: "bg-ink-400",
    live: LIVE_BY_SOURCE["Direct Reg-S"] + LIVE_BY_SOURCE["Reg-A+"],
    rate: "curated cohort",
    body:
      "Companies that don't wait for Robinhood — they issue directly on-chain via a Cayman/Jersey SPV (Reg-S) or SEC-qualified vehicle (Reg-A+). Cap tables live in a CapTable.sol contract on Robinhood Chain.",
  },
];

export function DealFlow() {
  return (
    <Section>
      <SectionHeader
        eyebrow="Deal flow"
        title={
          <>
            <span className="text-forest-500 tabular-nums">{TOTAL_LIVE}</span>{" "}
            live vaults today. Designed for zero human bottleneck.
          </>
        }
        description={
          <>
            RPO is designed not to be rate-limited by any single upstream.
            Four independent pipelines — three of them fully automatable —
            push new subscription vaults on-chain around the clock once the
            protocol is deployed.
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-2 mt-14">
        {PIPES.map((p) => (
          <div
            key={p.n}
            className="card-hover p-8 flex flex-col gap-5 relative overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={"h-2 w-2 rounded-full " + p.dot} />
                <span className="text-[11px] uppercase tracking-[0.18em] text-ink-500 font-mono">
                  Pipeline {p.n}
                </span>
              </div>
              <div className="text-right">
                <div className="font-display text-4xl text-ink-900 tabular-nums leading-none">
                  {p.live}
                </div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-mono mt-1">
                  live now
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-display text-2xl text-ink-900">{p.tag}</h3>
              <div className="text-xs text-forest-500 font-mono mt-1">
                {p.rate}
              </div>
            </div>

            <p className="text-sm text-ink-500 leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border border-line rounded-2xl p-6 bg-paper-100">
        <div>
          <div className="text-sm font-semibold text-ink-900">
            Once live: connect a wallet and subscribe. No KYC, no waitlist,
            no allocation gate.
          </div>
          <div className="text-xs text-ink-500 mt-1">
            Compliance handled at the edge (Reg-S geo-block) + at the contract
            (ERC-3643 transfer policy). Never at the user.
          </div>
        </div>
        <Link
          href="/app"
          className="inline-flex items-center gap-2 rounded-full bg-ink-900 hover:bg-ink-800 text-white text-sm px-5 py-2.5 shadow-soft"
        >
          Open the app →
        </Link>
      </div>
    </Section>
  );
}
