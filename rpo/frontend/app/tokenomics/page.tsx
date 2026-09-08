import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Prose } from "@/components/ui/Prose";
import { H2 } from "@/components/ui/H";
import { Badge } from "@/components/ui/Badge";
import { Sphere } from "@/components/ui/Sphere";
import { BoostCurve } from "@/components/interactive/BoostCurve";
import { LeverageSimulator } from "@/components/interactive/LeverageSimulator";
import { RPO_ADDRESSES, shortAddr } from "@/lib/addresses";

export const metadata = {
  title: "Tokenomics",
  description:
    "$RPO — supply, distribution, boost curve, and the fee-to-buyback flywheel.",
};

const ALLOC = [
  { label: "Fair launch on Pons", pct: 55, color: "#0B4D3E" },
  { label: "Boost accrual (streamed)", pct: 20, color: "#3A8E5B" },
  { label: "Ecosystem grants", pct: 10, color: "#FF6A3D" },
  { label: "Protocol-owned liquidity", pct: 8, color: "#FFA37A" },
  { label: "Core team (4y linear)", pct: 5, color: "#0A0A0A" },
  { label: "Bug bounty escrow", pct: 2, color: "#8A8D93" },
];

export default function TokenomicsPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="$RPO"
        title="A boost token, not a governance placebo."
        description="$RPO exists to solve one problem: allocate scarce IPO capacity fairly, so patient stakers get a real edge without letting a whale buy the entire book."
      />

      <section className="section">
        <div className="container-wide grid lg:grid-cols-3 gap-6">
          <StatBox label="Fixed supply" value="1,000,000,000" hint="No inflation, no vesting cliffs, no VC round" />
          <StatBox label="Launch venue" value="Pons · fair launch" hint="Bonding curve → Uniswap V4 (LP burned)" />
          <StatBox label="Fee capture" value="80% buyback → stakers" hint="20% to protocol-owned Pons LPs" />
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide grid lg:grid-cols-[420px_1fr] gap-16 items-start">
          <div className="relative">
            <Sphere variant="forest" size={220} className="absolute -top-8 -right-8 opacity-70" />
            <DonutSVG data={ALLOC} />
          </div>
          <div>
            <div className="eyebrow mb-4">Allocation</div>
            <h2 className="font-display text-4xl text-ink-900 mb-6">
              550M to fair launch. Zero to VCs.
            </h2>
            <p className="text-ink-500 mb-8 leading-relaxed">
              The largest single allocation goes to the open market via the
              Pons bonding curve. The next largest — 20% — is streamed to
              stakers over 4 years as fee-to-buyback accrual. Everything
              vests linearly with no cliffs; the team unlock is publicly
              verifiable at{" "}
              <a
                href="https://sablier.com/vesting/rpo"
                className="text-forest-500 hover:underline"
              >
                sablier.com/vesting/rpo
              </a>
              .
            </p>
            <div className="space-y-3">
              {ALLOC.map((a) => (
                <div key={a.label} className="flex items-center gap-4 text-sm">
                  <div
                    className="h-3 w-3 rounded-sm flex-shrink-0"
                    style={{ background: a.color }}
                  />
                  <div className="flex-1 text-ink-900">{a.label}</div>
                  <div className="font-mono text-ink-500 tabular-nums">
                    {a.pct}% · {(a.pct * 10).toLocaleString()}M
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-wide">
          <div className="eyebrow mb-4">The Flywheel</div>
          <h2 className="font-display text-4xl text-ink-900 mb-10 max-w-2xl">
            Every subscribed dollar tightens the boost.
          </h2>

          <div className="grid md:grid-cols-4 gap-4">
            {[
              {
                n: "01",
                title: "User subscribes",
                body: "USDG flows into a SubscriptionVault. Protocol collects a flat 2% fee.",
              },
              {
                n: "02",
                title: "Buyback",
                body: "80% of the fee is spent on open-market $RPO on the Pons SPY-pair, TWAP'd across an epoch.",
              },
              {
                n: "03",
                title: "Stream to stakers",
                body: "Acquired $RPO is added to AllocationBooster and distributed by time-weighted stake.",
              },
              {
                n: "04",
                title: "Boost tightens",
                body: "Each new epoch, average boost rises — the same subscription buys more of the next IPO.",
              },
            ].map((s, i) => (
              <div key={i} className="card p-6">
                <div className="text-[11px] font-mono text-ink-500 mb-3">{s.n}</div>
                <div className="font-semibold text-ink-900 mb-2">{s.title}</div>
                <div className="text-sm text-ink-500 leading-relaxed">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight border-t border-line">
        <div className="container-wide grid lg:grid-cols-2 gap-6">
          <BoostCurve />
          <LeverageSimulator />
        </div>
      </section>

      <section className="section-tight border-t border-line">
        <div className="container-wide max-w-4xl">
          <Prose>
            <H2 id="curve">The boost curve, formally</H2>
            <p>
              For a user with stake <code>s</code> and total pool{" "}
              <code>T</code>, the boost applied to that user&apos;s vault
              subscription is:
            </p>
            <pre>
              <code>{`boost(s, T) = min(3, 1 + 2 · sqrt(s / T))`}</code>
            </pre>
            <table>
              <thead>
                <tr>
                  <th>Stake share</th>
                  <th>Boost</th>
                  <th>Marginal cost of next 1% share</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>0.01%</td><td>1.02×</td><td>—</td></tr>
                <tr><td>0.1%</td><td>1.06×</td><td>+0.04×</td></tr>
                <tr><td>1%</td><td>1.20×</td><td>+0.14×</td></tr>
                <tr><td>5%</td><td>1.45×</td><td>+0.25×</td></tr>
                <tr><td>10%</td><td>1.63×</td><td>+0.18×</td></tr>
                <tr><td>25%</td><td>2.00×</td><td>+0.37×</td></tr>
                <tr><td>50%</td><td>2.41×</td><td>+0.41×</td></tr>
                <tr><td>100%</td><td>3.00× (cap)</td><td>capped</td></tr>
              </tbody>
            </table>
            <p>
              Small stakers get near-full return on their first stake; a
              would-be whale sees strong diminishing returns after 5% share.
              Because subscription weight is <code>amount × boost</code>,
              the boost curve translates directly into allocation-per-USDG.
            </p>

            <H2 id="emissions">Emissions schedule</H2>
            <p>
              There are no protocol emissions in the traditional sense.
              The <em>only</em> ongoing $RPO issuance to stakers comes from
              buybacks, funded by real subscription fee revenue. This means:
            </p>
            <ul>
              <li>
                Total circulating supply is bounded above by 1B and only
                changes when the team allocation vests linearly.
              </li>
              <li>
                Real yield on staked $RPO is a function of monthly platform
                fee volume, published live at{" "}
                <a href="https://dune.com/rpo">dune.com/rpo</a>.
              </li>
              <li>
                In a zero-volume month, staker yield is zero (no dilution).
                In a $100M-volume month, ~$2M of $RPO is purchased and
                distributed.
              </li>
            </ul>
          </Prose>
        </div>
      </section>

      <section className="section border-t border-line bg-ink-900 text-white">
        <div className="container-wide grid md:grid-cols-3 gap-6">
          <div className="col-span-1">
            <Badge variant="peach">Contract</Badge>
            <h2 className="font-display text-3xl mt-4 mb-6">
              $RPO on chain.
            </h2>
          </div>
          <div className="md:col-span-2 space-y-4">
            {[
              { k: "Chain", v: `${RPO_ADDRESSES.chainName} · id ${RPO_ADDRESSES.chainId}` },
              { k: "$RPO token", v: shortAddr(RPO_ADDRESSES.tokens.RPO), mono: true },
              { k: "AllocationBooster", v: shortAddr(RPO_ADDRESSES.contracts.AllocationBooster), mono: true },
              { k: "Pons RPO/SPY pool", v: `${shortAddr(RPO_ADDRESSES.pons.RpoSpyPool)} · LP burned`, mono: true },
              { k: "Timelock", v: shortAddr(RPO_ADDRESSES.contracts.Timelock), mono: true },
              { k: "Governor", v: shortAddr(RPO_ADDRESSES.contracts.Governor), mono: true },
            ].map((r) => (
              <div
                key={r.k}
                className="flex items-center justify-between border-b border-white/10 py-3"
              >
                <div className="text-white/60 text-sm">{r.k}</div>
                <div className={r.mono ? "font-mono text-sm text-white" : "text-white"}>
                  {r.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function StatBox({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="card p-8">
      <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500 mb-3">
        {label}
      </div>
      <div className="font-display text-3xl text-ink-900 tabular-nums">{value}</div>
      <div className="text-sm text-ink-500 mt-3">{hint}</div>
    </div>
  );
}

function DonutSVG({ data }: { data: { label: string; pct: number; color: string }[] }) {
  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const r = 160;
  const inner = 100;
  let angle = -Math.PI / 2;

  const slices = data.map((d) => {
    const sweep = (d.pct / 100) * Math.PI * 2;
    const startAngle = angle;
    const endAngle = angle + sweep;
    angle = endAngle;
    const large = sweep > Math.PI ? 1 : 0;
    const x1 = cx + Math.cos(startAngle) * r;
    const y1 = cy + Math.sin(startAngle) * r;
    const x2 = cx + Math.cos(endAngle) * r;
    const y2 = cy + Math.sin(endAngle) * r;
    const xi1 = cx + Math.cos(endAngle) * inner;
    const yi1 = cy + Math.sin(endAngle) * inner;
    const xi2 = cx + Math.cos(startAngle) * inner;
    const yi2 = cy + Math.sin(startAngle) * inner;
    const d_ = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${inner} ${inner} 0 ${large} 0 ${xi2} ${yi2} Z`;
    return { d: d_, color: d.color };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-w-md">
      {slices.map((s, i) => (
        <path key={i} d={s.d} fill={s.color} />
      ))}
      <circle cx={cx} cy={cy} r={inner} fill="#FFFFFF" />
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        fontFamily="Fraunces, serif"
        fontStyle="italic"
        fontSize="42"
        fill="#0A0A0A"
      >
        1B
      </text>
      <text
        x={cx}
        y={cy + 20}
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontSize="12"
        letterSpacing="2.5"
        fill="#5C5F66"
      >
        $RPO SUPPLY
      </text>
    </svg>
  );
}
