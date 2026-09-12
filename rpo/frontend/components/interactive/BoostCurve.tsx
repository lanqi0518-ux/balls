"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Interactive $RPO boost curve.
 *
 * The formula boost(s, T) = min(3, 1 + 2·sqrt(s/T)) is rendered live
 * as an SVG line, with a draggable slider that recomputes:
 *   · your share of the staking pool
 *   · your effective boost multiplier
 *   · allocation you'd receive on a $10k subscription vs. a passive
 *     $10k subscription with 1× boost.
 */
export function BoostCurve() {
  const [poolPct, setPoolPct] = useState(1); // %
  const [subUsd, setSubUsd] = useState(10_000);
  const [medianBoost] = useState(1.05); // representative other-user boost

  const share = poolPct / 100;
  const boost = Math.min(3, 1 + 2 * Math.sqrt(share));
  const yourWeight = subUsd * boost;
  const baseWeight = subUsd * medianBoost;
  const uplift = ((yourWeight / baseWeight - 1) * 100).toFixed(1);

  const points = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const s = i / 100;
      const b = Math.min(3, 1 + 2 * Math.sqrt(s));
      pts.push([i, b]);
    }
    return pts;
  }, []);

  const { path, dot } = useMemo(() => {
    // Chart: 0..100 x → 0..320 px; 1..3 y → 200..20 px
    const xForI = (i: number) => 40 + (i / 100) * 320;
    const yForB = (b: number) => 200 - ((b - 1) / 2) * 180;
    const path = points
      .map(([i, b], k) => `${k === 0 ? "M" : "L"} ${xForI(i).toFixed(1)} ${yForB(b).toFixed(1)}`)
      .join(" ");
    const dot = { x: xForI(poolPct), y: yForB(boost) };
    return { path, dot };
  }, [points, poolPct, boost]);

  return (
    <div className="rounded-3xl border border-line bg-white p-6 lg:p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="eyebrow mb-2">Interactive</div>
          <div className="text-xl font-display text-ink-900">
            Compute your boost.
          </div>
          <div className="text-sm text-ink-500 mt-1">
            Drag the sliders — every number recomputes live.
          </div>
        </div>
        <div className="hidden md:block text-right">
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-500 font-mono">
            formula
          </div>
          <div className="font-mono text-xs text-ink-900 mt-1">
            boost(s) = min(3, 1 + 2·√(s/T))
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_240px] gap-8 items-center">
        {/* Chart */}
        <div className="relative">
          <svg viewBox="0 0 400 220" className="w-full h-auto">
            <defs>
              <linearGradient id="bc-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#0B4D3E" stopOpacity="0.15" />
                <stop offset="1" stopColor="#0B4D3E" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {/* Grid */}
            {[1, 1.5, 2, 2.5, 3].map((b) => {
              const y = 200 - ((b - 1) / 2) * 180;
              return (
                <g key={b}>
                  <line x1={40} y1={y} x2={360} y2={y} stroke="#0A0A0A" strokeOpacity={0.05} />
                  <text
                    x={32}
                    y={y + 3}
                    fontFamily="JetBrains Mono, monospace"
                    fontSize={9}
                    fill="#8A8D93"
                    textAnchor="end"
                  >
                    {b}×
                  </text>
                </g>
              );
            })}
            {[0, 25, 50, 75, 100].map((p) => {
              const x = 40 + (p / 100) * 320;
              return (
                <g key={p}>
                  <line x1={x} y1={200} x2={x} y2={205} stroke="#0A0A0A" strokeOpacity={0.15} />
                  <text
                    x={x}
                    y={216}
                    fontFamily="JetBrains Mono, monospace"
                    fontSize={9}
                    fill="#8A8D93"
                    textAnchor="middle"
                  >
                    {p}%
                  </text>
                </g>
              );
            })}
            {/* Fill under curve */}
            <path d={`${path} L 360 200 L 40 200 Z`} fill="url(#bc-fill)" />
            {/* Curve */}
            <path d={path} stroke="#0B4D3E" strokeWidth={2} fill="none" />
            {/* 3× cap line */}
            <line
              x1={40}
              y1={20}
              x2={360}
              y2={20}
              stroke="#FF6A3D"
              strokeDasharray="3 3"
              strokeOpacity={0.6}
            />
            <text x={356} y={16} fontFamily="JetBrains Mono, monospace" fontSize={9} fill="#FF6A3D" textAnchor="end">
              3× cap
            </text>
            {/* Marker */}
            <line x1={dot.x} y1={dot.y} x2={dot.x} y2={200} stroke="#0B4D3E" strokeDasharray="2 3" strokeOpacity={0.35} />
            <circle cx={dot.x} cy={dot.y} r={5} fill="#FFFFFF" stroke="#0B4D3E" strokeWidth={2} />
          </svg>
        </div>

        {/* Sliders + readout */}
        <div className="space-y-6">
          <SliderRow
            label="Your pool share"
            value={poolPct}
            min={0.01}
            max={100}
            step={0.01}
            onChange={setPoolPct}
            display={`${poolPct < 1 ? poolPct.toFixed(2) : poolPct.toFixed(1)}%`}
          />
          <SliderRow
            label="Subscription size"
            value={subUsd}
            min={100}
            max={100_000}
            step={100}
            onChange={setSubUsd}
            display={`$${subUsd.toLocaleString()}`}
          />

          <div className="pt-4 border-t border-line space-y-3">
            <ReadRow label="Boost multiplier" value={`${boost.toFixed(3)}×`} highlight />
            <ReadRow
              label="Weight vs. median"
              value={`+${uplift}%`}
              hint={`median staker boost = ${medianBoost}×`}
              highlight
            />
            <ReadRow
              label="Weighted claim"
              value={`$${Math.round(yourWeight).toLocaleString()}`}
              hint={`= $${subUsd.toLocaleString()} × ${boost.toFixed(3)}×`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  label, value, min, max, step, onChange, display,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; display: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[11px] uppercase tracking-[0.14em] text-ink-500 font-mono">
          {label}
        </span>
        <span className="font-mono text-sm text-ink-900 tabular-nums">
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 accent-forest-500 cursor-pointer"
      />
    </div>
  );
}

function ReadRow({
  label, value, hint, highlight,
}: {
  label: string; value: string; hint?: string; highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm text-ink-500">{label}</div>
        {hint && (
          <div className="text-[11px] text-ink-500 font-mono mt-0.5">{hint}</div>
        )}
      </div>
      <div
        className={cn(
          "font-mono tabular-nums whitespace-nowrap",
          highlight ? "text-ink-900 font-semibold text-lg" : "text-ink-900"
        )}
      >
        {value}
      </div>
    </div>
  );
}
