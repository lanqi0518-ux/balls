import { Section } from "@/components/ui/Section";
import { LinkButton } from "@/components/ui/Button";
import { ArrowUpRight } from "@/components/ui/Icons";
import { Badge } from "@/components/ui/Badge";
import { Sphere } from "@/components/ui/Sphere";

export function RPOTokenSection() {
  return (
    <Section id="token" className="relative overflow-hidden">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div className="eyebrow mb-5">The $RPO token</div>
          <h2 className="font-display text-display-sm text-ink-900 mb-6">
            The token that gives you{" "}
            <span className="italic">early access</span>.
          </h2>
          <p className="text-lg text-ink-500 leading-relaxed max-w-lg mb-8">
            Stake $RPO to boost your allocation on every IPO — up to 3×. In
            the intended fee design, 80% of platform fees flow into open-market
            $RPO buybacks through Pons. The token has not launched yet.
          </p>

          <div className="flex flex-wrap items-center gap-2 mb-10">
            <Badge variant="peach">Pre-launch</Badge>
            <Badge variant="forest">Proposed 1B fixed supply</Badge>
            <Badge>Intended fair launch on Pons</Badge>
            <Badge>No team unlock cliff</Badge>
          </div>

          <div className="flex flex-wrap gap-3">
            <LinkButton
              href="/tokenomics"
              size="md"
              trailingIcon={<ArrowUpRight className="h-4 w-4" />}
            >
              Read tokenomics
            </LinkButton>
            <LinkButton
              href="/app/stake"
              variant="outline"
              size="md"
              trailingIcon={<ArrowUpRight className="h-4 w-4" />}
            >
              Stake interface
            </LinkButton>
          </div>
        </div>

        <div className="relative">
          {/* Background 3D sphere */}
          <Sphere
            variant="peach"
            size={520}
            className="absolute -top-16 -right-20 opacity-70 pointer-events-none animate-float-slow"
          />

          <div className="relative card-floating p-10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="eyebrow">Allocation boost</div>
              <Badge variant="forest">3× cap</Badge>
            </div>
            <BoostCurve />
            <div className="text-xs text-ink-500 leading-relaxed border-t border-line pt-5">
              <span className="font-mono text-forest-500 bg-forest-50 px-1.5 py-0.5 rounded">
                boost = 1 + 2·√share
              </span>{" "}
              — capped at 3×. Sqrt keeps early stakers rewarded without letting
              whales monopolize allocations.
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function BoostCurve() {
  const points: string[] = [];
  const w = 340;
  const h = 160;
  for (let i = 0; i <= 100; i++) {
    const s = i / 100;
    const boost = Math.min(3, 1 + 2 * Math.sqrt(s));
    const x = (i / 100) * w;
    const y = h - ((boost - 1) / 2) * h;
    points.push(`${x},${y}`);
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" aria-hidden>
      <defs>
        <linearGradient id="boost-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0B4D3E" stopOpacity="0.28" />
          <stop offset="1" stopColor="#0B4D3E" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="boost-line" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#0B4D3E" />
          <stop offset="1" stopColor="#FF6A3D" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1="0"
          x2={w}
          y1={(i / 4) * h}
          y2={(i / 4) * h}
          stroke="rgba(10,10,10,0.06)"
        />
      ))}
      <polygon
        points={`0,${h} ${points.join(" ")} ${w},${h}`}
        fill="url(#boost-fill)"
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="url(#boost-line)"
        strokeWidth={2.5}
      />
      <line
        x1="0"
        x2={w}
        y1={h - ((3 - 1) / 2) * h}
        y2={h - ((3 - 1) / 2) * h}
        stroke="rgba(255,106,61,0.5)"
        strokeDasharray="4 4"
      />
      <text
        x={w - 6}
        y={h - ((3 - 1) / 2) * h - 6}
        textAnchor="end"
        fill="#FF6A3D"
        fontSize="10"
        fontFamily="var(--font-mono)"
      >
        3× cap
      </text>
    </svg>
  );
}
