"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Interactive LeverageLooper simulator.
 *
 * Given a collateral value, target LTV, and Morpho market LLTV, computes:
 *   · borrowed USDG
 *   · health factor
 *   · liquidation price (how far mark can drop before HF = 1)
 *   · effective IPO exposure after auto-subscribe
 *
 * Also plots health factor vs. mark change so the user can see the
 * liquidation cliff at a glance.
 */
export function LeverageSimulator() {
  const [collat, setCollat] = useState(10_000); // USD value
  const [targetLtvPct, setTargetLtvPct] = useState(60);
  const [markDrop, setMarkDrop] = useState(0);
  const lltvPct = 80;

  const targetLtv = targetLtvPct / 100;
  const lltv = lltvPct / 100;
  const borrow = collat * targetLtv;
  const exposure = collat + borrow;

  // HF = collateral_value * LLTV / debt
  const markMult = 1 + markDrop / 100;
  const collatNow = collat * markMult;
  const hf = borrow > 0 ? (collatNow * lltv) / borrow : Infinity;
  const liqDrop = ((borrow / (collat * lltv) - 1) * 100).toFixed(1);
  const status =
    hf >= 1.5
      ? { label: "Healthy", color: "text-forest-500 bg-forest-50 border-forest-200" }
      : hf >= 1.1
      ? { label: "Warn", color: "text-peach-600 bg-peach-50 border-peach-200" }
      : { label: "Liquidatable", color: "text-rose-600 bg-rose-50 border-rose-200" };

  const path = useMemo(() => {
    // x: mark change -50%..+50%, y: HF 0..3
    const pts: [number, number][] = [];
    for (let d = -50; d <= 50; d += 1) {
      const m = 1 + d / 100;
      const h = borrow > 0 ? (collat * m * lltv) / borrow : 3;
      pts.push([d, Math.min(3, h)]);
    }
    const xFor = (d: number) => 40 + ((d + 50) / 100) * 320;
    const yFor = (h: number) => 190 - (h / 3) * 170;
    return pts
      .map(([d, h], i) => `${i === 0 ? "M" : "L"} ${xFor(d).toFixed(1)} ${yFor(h).toFixed(1)}`)
      .join(" ");
  }, [borrow, collat, lltv]);

  const markerX = 40 + ((markDrop + 50) / 100) * 320;
  const markerY = 190 - (Math.min(3, Math.max(0, hf)) / 3) * 170;

  return (
    <div className="rounded-3xl border border-line bg-white p-6 lg:p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="eyebrow mb-2">Interactive</div>
          <div className="text-xl font-display text-ink-900">
            Loop simulator.
          </div>
          <div className="text-sm text-ink-500 mt-1">
            Model borrow, exposure, and liquidation cliff before you commit.
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono",
            status.color
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {status.label}
        </span>
      </div>

      <div className="grid lg:grid-cols-[1fr_260px] gap-8 items-center">
        {/* Chart */}
        <svg viewBox="0 0 400 210" className="w-full h-auto">
          <defs>
            <linearGradient id="ls-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FF6A3D" stopOpacity="0.14" />
              <stop offset="1" stopColor="#FF6A3D" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {/* HF grid */}
          {[0, 1, 1.5, 2, 3].map((h) => {
            const y = 190 - (h / 3) * 170;
            return (
              <g key={h}>
                <line
                  x1={40} y1={y} x2={360} y2={y}
                  stroke={h === 1 ? "#FF6A3D" : "#0A0A0A"}
                  strokeOpacity={h === 1 ? 0.5 : 0.05}
                  strokeDasharray={h === 1 ? "3 3" : undefined}
                />
                <text
                  x={32} y={y + 3}
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={9}
                  fill={h === 1 ? "#FF6A3D" : "#8A8D93"}
                  textAnchor="end"
                >
                  {h === 0 ? "0" : `${h.toFixed(1)}`}
                </text>
              </g>
            );
          })}
          {/* Mark axis */}
          {[-50, -25, 0, 25, 50].map((d) => {
            const x = 40 + ((d + 50) / 100) * 320;
            return (
              <g key={d}>
                <line x1={x} y1={190} x2={x} y2={195} stroke="#0A0A0A" strokeOpacity={0.15} />
                <text
                  x={x} y={206}
                  fontFamily="JetBrains Mono, monospace"
                  fontSize={9}
                  fill="#8A8D93"
                  textAnchor="middle"
                >
                  {d > 0 ? "+" : ""}
                  {d}%
                </text>
              </g>
            );
          })}
          {/* Curve */}
          <path d={`${path} L 360 190 L 40 190 Z`} fill="url(#ls-fill)" />
          <path d={path} stroke="#FF6A3D" strokeWidth={2} fill="none" />
          {/* Marker */}
          <line x1={markerX} y1={markerY} x2={markerX} y2={190} stroke="#0B4D3E" strokeDasharray="2 3" strokeOpacity={0.4} />
          <circle cx={markerX} cy={markerY} r={5} fill="#FFFFFF" stroke="#0B4D3E" strokeWidth={2} />
          <text
            x={20}
            y={16}
            fontFamily="JetBrains Mono, monospace"
            fontSize={10}
            fill="#8A8D93"
          >
            HEALTH FACTOR
          </text>
          <text
            x={380}
            y={206}
            fontFamily="JetBrains Mono, monospace"
            fontSize={10}
            fill="#8A8D93"
            textAnchor="end"
          >
            ← Mark change →
          </text>
        </svg>

        {/* Sliders */}
        <div className="space-y-5">
          <SliderRow
            label="Collateral (USD)"
            value={collat}
            min={100}
            max={200_000}
            step={100}
            onChange={setCollat}
            display={`$${collat.toLocaleString()}`}
          />
          <SliderRow
            label="Target LTV"
            value={targetLtvPct}
            min={10}
            max={75}
            step={1}
            onChange={setTargetLtvPct}
            display={`${targetLtvPct}%`}
          />
          <SliderRow
            label="Mark change"
            value={markDrop}
            min={-50}
            max={50}
            step={0.5}
            onChange={setMarkDrop}
            display={`${markDrop > 0 ? "+" : ""}${markDrop.toFixed(1)}%`}
          />

          <div className="pt-4 border-t border-line space-y-2.5 text-sm">
            <Row k="Borrowed USDG" v={`$${Math.round(borrow).toLocaleString()}`} />
            <Row k="IPO exposure" v={`$${Math.round(exposure).toLocaleString()}`} />
            <Row
              k="Liquidation at"
              v={`${liqDrop}%`}
              hint={`LLTV cap ${lltvPct}%`}
              danger={parseFloat(liqDrop) > -12}
            />
            <Row k="Health factor" v={`${hf === Infinity ? "∞" : hf.toFixed(2)}`} highlight />
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
        <span className="font-mono text-sm text-ink-900 tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 accent-peach-500 cursor-pointer"
      />
    </div>
  );
}

function Row({
  k, v, hint, highlight, danger,
}: {
  k: string; v: string; hint?: string; highlight?: boolean; danger?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-ink-500">{k}</div>
        {hint && (
          <div className="text-[11px] text-ink-500 font-mono">{hint}</div>
        )}
      </div>
      <div
        className={cn(
          "font-mono tabular-nums whitespace-nowrap",
          highlight
            ? "text-ink-900 font-semibold text-base"
            : danger
            ? "text-rose-600"
            : "text-ink-900"
        )}
      >
        {v}
      </div>
    </div>
  );
}
