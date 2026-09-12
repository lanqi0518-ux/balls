"use client";

/**
 * A hand-rolled SVG dataflow diagram showing every RPO contract, its
 * on-chain neighbours, and the transaction paths between them.
 *
 * Reads like an architecture-review whiteboard — three layered lanes:
 *   1. User-facing surfaces (App / SDK / API / Keeper)
 *   2. RPO protocol contracts
 *   3. External venues + oracles
 * Arrows carry a label naming the call.
 *
 * Deliberately zero animation on load; a subtle pulse only on hover of
 * the labelled edges. Renders crisply on any background.
 */
export function ArchitectureDiagram({ className }: { className?: string }) {
  return (
    <div
      className={
        "not-prose relative rounded-3xl border border-line bg-white overflow-hidden " +
        (className ?? "")
      }
    >
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="relative p-6 lg:p-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="eyebrow mb-2">Architecture</div>
            <div className="text-xl font-display text-ink-900">
              Every call, in one diagram.
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4 text-[11px] font-mono text-ink-500">
            <Legend color="#0B4D3E" label="RPO contract" />
            <Legend color="#FF6A3D" label="External" />
            <Legend color="#0A0A0A" label="Surface" />
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox="0 0 1120 620"
            className="w-full h-auto min-w-[880px]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <marker
                id="arr"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0 0 L10 5 L0 10 Z" fill="#0A0A0A" />
              </marker>
              <marker
                id="arr-forest"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0 0 L10 5 L0 10 Z" fill="#0B4D3E" />
              </marker>
              <marker
                id="arr-peach"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M0 0 L10 5 L0 10 Z" fill="#FF6A3D" />
              </marker>
              <linearGradient id="ink" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#0A0A0A" />
                <stop offset="1" stopColor="#212226" />
              </linearGradient>
              <linearGradient id="forest" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#0B4D3E" />
                <stop offset="1" stopColor="#1E6A56" />
              </linearGradient>
              <linearGradient id="peach" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#FF6A3D" />
                <stop offset="1" stopColor="#FFA37A" />
              </linearGradient>
            </defs>

            {/* lane backgrounds */}
            <g opacity="0.5">
              <rect x="30" y="24" width="1060" height="140" rx="18" fill="#FAF9F5" />
              <rect x="30" y="204" width="1060" height="200" rx="18" fill="#F5F3EC" />
              <rect x="30" y="444" width="1060" height="150" rx="18" fill="#FAF9F5" />
            </g>

            {/* Lane labels */}
            <text x="52" y="52" fontFamily="Inter" fontSize="10" letterSpacing="2" fill="#8A8D93">
              L1 · SURFACES
            </text>
            <text x="52" y="232" fontFamily="Inter" fontSize="10" letterSpacing="2" fill="#8A8D93">
              L2 · RPO PROTOCOL (RH CHAIN 4663)
            </text>
            <text x="52" y="472" fontFamily="Inter" fontSize="10" letterSpacing="2" fill="#8A8D93">
              L3 · EXTERNAL VENUES + ORACLES
            </text>

            {/* SURFACES row */}
            <Node x={90} y={70} w={180} h={72} title="Web App" sub="Next.js + wagmi" fill="url(#ink)" />
            <Node x={310} y={70} w={180} h={72} title="TypeScript SDK" sub="@rpo/sdk (planned)" fill="url(#ink)" />
            <Node x={530} y={70} w={180} h={72} title="REST API" sub="planned indexer" fill="url(#ink)" />
            <Node x={750} y={70} w={180} h={72} title="Keeper" sub="bonded executor set" fill="url(#ink)" />

            {/* PROTOCOL row */}
            <Node x={90} y={244} w={200} h={78} title="IPORegistry" sub="CREATE2 factory" fill="url(#forest)" light />
            <Node x={320} y={244} w={220} h={78} title="SubscriptionVault" sub="one per IPO · immutable" fill="url(#forest)" light />
            <Node x={570} y={244} w={200} h={78} title="AllocationBooster" sub="sqrt boost · 14d cooldown" fill="url(#forest)" light />
            <Node x={800} y={244} w={200} h={78} title="RialtoAdapter" sub="propAMM router" fill="url(#forest)" light />
            <Node x={320} y={340} w={220} h={64} title="LeverageLooper" sub="Morpho Blue loop" fill="url(#forest)" light />
            <Node x={570} y={340} w={200} h={64} title="FeeCollector" sub="80% buyback stream" fill="url(#forest)" light />

            {/* EXTERNAL row */}
            <Node x={90} y={490} w={160} h={68} title="Rialto propAMM" sub="MM-quoted USDG↔dTOKEN" fill="url(#peach)" />
            <Node x={280} y={490} w={160} h={68} title="Uniswap V4" sub="fallback route" fill="url(#peach)" />
            <Node x={470} y={490} w={160} h={68} title="Chainlink TR" sub="0.4s TR feeds" fill="url(#peach)" />
            <Node x={660} y={490} w={160} h={68} title="Aave v3" sub="idle-USDG yield" fill="url(#peach)" />
            <Node x={850} y={490} w={160} h={68} title="Morpho Blue" sub="isolated dTOKEN markets" fill="url(#peach)" />

            {/* Arrows — Surfaces → Protocol */}
            <Edge d="M 180 142 L 190 244" label="propose()" />
            <Edge d="M 400 142 L 430 244" label="subscribe()" />
            <Edge d="M 640 142 Q 660 190 670 244" label="boostOf()" />
            <Edge d="M 840 142 Q 800 190 460 244" label="fulfill()" thin />

            {/* Arrows — Protocol lateral */}
            <Edge d="M 290 283 L 320 283" label="deploy" thin />
            <Edge d="M 540 283 L 570 283" label="weight" thin />
            <Edge d="M 540 372 L 320 283" label="loop()" thin curve />
            <Edge d="M 540 340 L 570 340" label="fees" thin />
            <Edge d="M 800 283 L 770 283" label="buy" thin />

            {/* Arrows — Protocol → External */}
            <Edge
              d="M 900 322 Q 900 400 170 490"
              label="exactInput"
              color="#0B4D3E"
              marker="arr-forest"
            />
            <Edge
              d="M 900 322 Q 700 420 360 490"
              label="fallback"
              color="#0B4D3E"
              marker="arr-forest"
              thin
            />
            <Edge
              d="M 430 322 L 550 490"
              label="latestAnswer()"
              color="#0B4D3E"
              marker="arr-forest"
            />
            <Edge
              d="M 430 322 L 740 490"
              label="deposit()"
              color="#0B4D3E"
              marker="arr-forest"
              thin
            />
            <Edge
              d="M 430 404 L 930 490"
              label="supply/borrow"
              color="#0B4D3E"
              marker="arr-forest"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Node({
  x, y, w, h, title, sub, fill, light,
}: {
  x: number; y: number; w: number; h: number;
  title: string; sub: string; fill: string; light?: boolean;
}) {
  const textColor = "#FFFFFF";
  const subColor = light ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.7)";
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill={fill} />
      <text
        x={x + 16}
        y={y + 28}
        fontFamily="Inter"
        fontSize="14"
        fontWeight="600"
        fill={textColor}
      >
        {title}
      </text>
      <text
        x={x + 16}
        y={y + 48}
        fontFamily="JetBrains Mono, monospace"
        fontSize="10.5"
        fill={subColor}
      >
        {sub}
      </text>
    </g>
  );
}

function Edge({
  d, label, thin, curve, color = "#0A0A0A", marker = "arr",
}: {
  d: string; label: string; thin?: boolean; curve?: boolean;
  color?: string; marker?: string;
}) {
  return (
    <g>
      <path
        d={d}
        stroke={color}
        strokeWidth={thin ? 1 : 1.6}
        fill="none"
        strokeDasharray={thin ? "4 4" : undefined}
        markerEnd={`url(#${marker})`}
        opacity={0.72}
      />
      <EdgeLabel d={d} label={label} color={color} />
    </g>
  );
}

function EdgeLabel({ d, label, color }: { d: string; label: string; color: string }) {
  // Extract approximate mid coordinate — parse first two point pairs
  const nums = d.match(/-?\d+(?:\.\d+)?/g) || [];
  const x1 = parseFloat(nums[0] || "0");
  const y1 = parseFloat(nums[1] || "0");
  const xLast = parseFloat(nums[nums.length - 2] || "0");
  const yLast = parseFloat(nums[nums.length - 1] || "0");
  const cx = (x1 + xLast) / 2;
  const cy = (y1 + yLast) / 2;
  return (
    <g>
      <rect
        x={cx - label.length * 3.4 - 6}
        y={cy - 8}
        width={label.length * 6.8 + 12}
        height={16}
        rx={4}
        fill="#FFFFFF"
        stroke={color}
        strokeOpacity="0.14"
      />
      <text
        x={cx}
        y={cy + 4}
        fontFamily="JetBrains Mono, monospace"
        fontSize="10"
        fill={color}
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-sm"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
