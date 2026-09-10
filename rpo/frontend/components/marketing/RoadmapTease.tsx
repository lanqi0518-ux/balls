import Link from "next/link";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight } from "@/components/ui/Icons";

const PHASES = [
  {
    n: "00",
    codename: "Subscribe",
    year: "Pre-launch",
    body: "Non-US retail subscribes to RHJ Reg-S Stock Tokens. Contracts written; awaiting audits + mainnet deploy.",
    status: "next" as const,
  },
  {
    n: "01",
    codename: "Issue · Reg-S",
    year: "Phase 01",
    body: "Companies IPO on RPO directly under Reg-S — global-non-US reach, day 1 on chain.",
    status: "planned" as const,
  },
  {
    n: "02",
    codename: "Issue · Reg-D",
    year: "Phase 02",
    body: "Unlimited-raise institutional issuances with on-chain accreditation gating.",
    status: "planned" as const,
  },
  {
    n: "03",
    codename: "Issue · Reg-A+",
    year: "Phase 03",
    body: "US retail IPOs on chain. $75M / yr per issuer, SEC-qualified.",
    status: "vision" as const,
  },
  {
    n: "04",
    codename: "Compete",
    year: "Phase 04",
    body: "Full S-1 tokenized IPOs + FINRA ATS. Direct NASDAQ alternative.",
    status: "vision" as const,
  },
];

const STATUS_STYLE: Record<
  (typeof PHASES)[number]["status"],
  { border: string; dot: string; badge: "forest" | "peach" | "default" }
> = {
  next: { border: "#FF6A3D", dot: "bg-peach-500", badge: "peach" },
  planned: { border: "rgba(10,10,10,0.15)", dot: "bg-ink-500", badge: "default" },
  vision: { border: "rgba(10,10,10,0.08)", dot: "bg-ink-300", badge: "default" },
};

export function RoadmapTease() {
  return (
    <Section>
      <SectionHeader
        eyebrow="Roadmap"
        title={
          <>
            From an IPO subscription protocol to an{" "}
            <span className="italic font-display text-peach-500">
              on-chain public market.
            </span>
          </>
        }
        description="RPO is pre-launch. Phase 00 (permissionless subscription) is the near-term target once contracts are audited and deployed. Later phases add on-chain issuance under Reg-S, Reg-D, Reg-A+, and eventually S-1 with a FINRA-registered ATS."
      />
      <div className="grid md:grid-cols-5 gap-3 mt-4">
        {PHASES.map((p) => {
          const st = STATUS_STYLE[p.status];
          return (
            <div
              key={p.n}
              className="relative border-t-2 pt-5 pb-6 pr-3"
              style={{ borderColor: st.border }}
            >
              <span
                className={
                  "absolute -top-[7px] left-0 h-3 w-3 rounded-full " + st.dot
                }
              />
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
                  Phase {p.n}
                </div>
                {p.status === "next" && (
                  <Badge variant="peach" dot>
                    Next
                  </Badge>
                )}
              </div>
              <div className="text-xs text-ink-500 font-mono mb-2">
                {p.year}
              </div>
              <div className="font-display text-xl text-ink-900 mb-2">
                {p.codename}
              </div>
              <div className="text-xs text-ink-500 leading-relaxed">
                {p.body}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Link
          href="/roadmap"
          className="btn-primary bg-ink-900 hover:bg-ink-700 text-white text-sm"
        >
          Read the full roadmap
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <div className="text-xs text-ink-500 max-w-sm">
          Includes the four legal paths (Reg-S / D / A+ / S-1), five
          historical precedents, and the three new contract modules delivered
          across phases 01 → 04.
        </div>
      </div>
    </Section>
  );
}
