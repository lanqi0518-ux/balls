/**
 * SVG chart of the AntiSnipeHook's linear-decay cap. Pure render —
 * no client hooks — so it composes cleanly inside a Server
 * Component.
 */
export function CapCurve({
  startUsdg,
  endUsdg,
  capBlocks,
}: {
  startUsdg: number;
  endUsdg: number;
  capBlocks: number;
}) {
  const W = 640;
  const H = 200;
  const padX = 40;
  const padY = 20;

  const xScale = (b: number) => padX + ((W - padX * 2) * b) / capBlocks;
  const yScale = (u: number) =>
    H - padY - ((H - padY * 2) * (u - startUsdg)) / (endUsdg - startUsdg || 1);

  const points: string[] = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const b = (capBlocks * i) / N;
    const u = startUsdg + ((endUsdg - startUsdg) * b) / capBlocks;
    points.push(`${xScale(b).toFixed(2)},${yScale(u).toFixed(2)}`);
  }
  const path = "M " + points.join(" L ");
  const area =
    "M " +
    xScale(0).toFixed(2) +
    "," +
    (H - padY).toFixed(2) +
    " L " +
    points.join(" L ") +
    " L " +
    xScale(capBlocks).toFixed(2) +
    "," +
    (H - padY).toFixed(2) +
    " Z";

  const gridBlocks = [0, capBlocks / 4, capBlocks / 2, (3 * capBlocks) / 4, capBlocks];
  const gridCaps = [startUsdg, (startUsdg + endUsdg) / 2, endUsdg];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          <linearGradient id="capfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#4ade80" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridCaps.map((c) => (
          <g key={c}>
            <line
              x1={padX}
              x2={W - padX}
              y1={yScale(c)}
              y2={yScale(c)}
              stroke="#e5e5e5"
              strokeDasharray="2 4"
            />
            <text
              x={padX - 6}
              y={yScale(c) + 3}
              textAnchor="end"
              fontSize="10"
              fontFamily="ui-monospace, monospace"
              fill="#737373"
            >
              {c.toLocaleString()}
            </text>
          </g>
        ))}
        {gridBlocks.map((b) => (
          <text
            key={b}
            x={xScale(b)}
            y={H - 4}
            textAnchor="middle"
            fontSize="10"
            fontFamily="ui-monospace, monospace"
            fill="#737373"
          >
            {Math.round(b)}
          </text>
        ))}
        <path d={area} fill="url(#capfill)" />
        <path d={path} stroke="#059669" strokeWidth={2} fill="none" />
        <circle cx={xScale(0)} cy={yScale(startUsdg)} r={4} fill="#059669" />
        <circle cx={xScale(capBlocks)} cy={yScale(endUsdg)} r={4} fill="#059669" />
        <text
          x={xScale(0) + 8}
          y={yScale(startUsdg) - 8}
          fontSize="11"
          fill="#059669"
        >
          startCap = {startUsdg.toLocaleString()} USDG
        </text>
        <text
          x={xScale(capBlocks) - 8}
          y={yScale(endUsdg) + 16}
          textAnchor="end"
          fontSize="11"
          fill="#059669"
        >
          endCap = {endUsdg.toLocaleString()} USDG
        </text>
      </svg>
      <div className="mt-2 text-[11px] text-ink-500 font-mono flex justify-between">
        <span>x = blocks since initialize()</span>
        <span>y = per-swap cap (USDG)</span>
      </div>
    </div>
  );
}
