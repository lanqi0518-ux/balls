import { Section } from "@/components/ui/Section";
import { LinkButton } from "@/components/ui/Button";
import { ArrowUpRight } from "@/components/ui/Icons";
import { Badge } from "@/components/ui/Badge";

export function RPOTokenSection() {
  return (
    <Section id="token">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="eyebrow mb-4">The $RPO token</div>
          <h2 className="font-display text-display-sm text-fg mb-6">
            The token that gives you{" "}
            <span className="italic text-mint-500">early access</span>.
          </h2>
          <p className="text-lg text-fg-muted leading-relaxed max-w-lg mb-8">
            Stake $RPO to boost your allocation on every IPO — up to 3×.
            80% of platform fees flow back into open-market $RPO buybacks
            through Pons, paired against SPY. The more the protocol
            processes, the tighter the float.
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-8">
            <Badge variant="mint">1B fixed supply</Badge>
            <Badge>39% staked</Badge>
            <Badge>Fair launch on Pons</Badge>
            <Badge>No team unlock cliff</Badge>
          </div>

          <div className="flex flex-wrap gap-3">
            <LinkButton
              href="/app/stake"
              size="md"
              trailingIcon={<ArrowUpRight className="h-4 w-4" />}
            >
              Stake $RPO
            </LinkButton>
            <LinkButton
              href="https://pons.dev"
              variant="outline"
              size="md"
              external
              trailingIcon={<ArrowUpRight className="h-4 w-4" />}
            >
              Buy on Pons
            </LinkButton>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
          <div className="relative card p-8 space-y-6">
            <div className="text-xs uppercase tracking-[0.14em] text-fg-dim">
              Allocation boost curve
            </div>
            <BoostCurve />
            <div className="text-xs text-fg-muted leading-relaxed border-t border-line pt-4">
              <span className="font-mono text-mint-400">boost = 1 + 2·√share</span>{" "}
              capped at 3×. Share = your stake ÷ total staked. Sqrt keeps early
              stakers rewarded without letting whales monopolize allocations.
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function BoostCurve() {
  const points: string[] = [];
  const w = 320;
  const h = 140;
  for (let i = 0; i <= 100; i++) {
    const s = i / 100;
    const boost = Math.min(3, 1 + 2 * Math.sqrt(s));
    const x = (i / 100) * w;
    const y = h - ((boost - 1) / 2) * h;
    points.push(`${x},${y}`);
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-auto"
      aria-hidden
    >
      <defs>
        <linearGradient id="boost-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#00E38F" stopOpacity="0.4" />
          <stop offset="1" stopColor="#00E38F" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* grid */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1="0"
          x2={w}
          y1={(i / 4) * h}
          y2={(i / 4) * h}
          stroke="rgba(255,255,255,0.05)"
        />
      ))}
      {/* filled area */}
      <polygon
        points={`0,${h} ${points.join(" ")} ${w},${h}`}
        fill="url(#boost-fill)"
      />
      {/* line */}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#00E38F"
        strokeWidth={2}
      />
      {/* markers */}
      <line
        x1="0"
        x2={w}
        y1={h - ((3 - 1) / 2) * h}
        y2={h - ((3 - 1) / 2) * h}
        stroke="rgba(0,227,143,0.35)"
        strokeDasharray="4 4"
      />
      <text
        x={w - 6}
        y={h - ((3 - 1) / 2) * h - 6}
        textAnchor="end"
        fill="#3EEFAF"
        fontSize="10"
        fontFamily="var(--font-mono)"
      >
        3× cap
      </text>
    </svg>
  );
}
