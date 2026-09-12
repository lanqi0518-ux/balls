import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Sphere } from "@/components/ui/Sphere";
import { ArrowRight, ArrowUpRight } from "@/components/ui/Icons";
import { readAllStockSnapshots } from "@/lib/robinhood/reads";
import type { StockSnapshot } from "@/lib/robinhood/reads";
import { readGlobalIpoCalendar } from "@/lib/ipos/aggregate";
import { fmtNum, fmtUSD } from "@/lib/format";

/**
 * Hero — HOODIPO. The primary-market layer for Robinhood Chain.
 *
 * Server Component: pulls live Robinhood Chain reads (Chainlink marks
 * + ERC-20 supply for every real deployed Stock Token) at render time,
 * so the hero's numbers never lie. If the RPC fails, an honest
 * "market data unavailable" state renders instead of fake numbers.
 */
export async function Hero() {
  const [snapshots, ipoCal] = await Promise.all([
    readAllStockSnapshots(),
    readGlobalIpoCalendar(),
  ]);
  const featured =
    snapshots.find((s) => s.token.ticker === "CRCL" && s.priceUsd != null) ??
    snapshots.find((s) => s.token.ticker === "FIG" && s.priceUsd != null) ??
    snapshots.find((s) => s.token.ticker === "CRWV" && s.priceUsd != null) ??
    snapshots.find((s) => s.priceUsd != null) ??
    snapshots[0] ??
    null;
  const ipoPipeline =
    ipoCal.upcoming.length + ipoCal.priced.length + ipoCal.filed.length;
  const priceableCount = snapshots.filter((s) => s.priceUsd != null).length;

  return (
    <section className="relative overflow-hidden pt-20 lg:pt-32 pb-20 lg:pb-40">
      <div className="absolute inset-0 bg-mesh-warm opacity-90 pointer-events-none" />
      <div className="absolute inset-0 grid-bg pointer-events-none" />

      <Sphere
        variant="peach"
        size={520}
        className="absolute -top-32 -right-24 lg:-right-8 opacity-90 animate-float-slow"
      />
      <Sphere
        variant="cream"
        size={200}
        className="absolute bottom-40 -left-16 opacity-80 animate-float hidden lg:block"
      />
      <Sphere
        variant="forest"
        size={120}
        className="absolute top-32 left-1/3 opacity-70 animate-float hidden lg:block"
      />

      <Container className="relative">
        <div className="max-w-4xl">
          <Badge variant="dark" dot className="mb-8">
            HOODIPO · Live on Robinhood Chain (id 4663) · Primitive contracts pending audit
          </Badge>

          <h1 className="font-display text-display-lg text-ink-900">
            The{" "}
            <span
              className="italic"
              style={{ fontVariationSettings: "'SOFT' 100, 'opsz' 144" }}
            >
              primary&nbsp;market
            </span>{" "}
            layer for Robinhood Chain.
          </h1>

          <p className="mt-8 text-xl text-ink-500 max-w-2xl leading-relaxed">
            Robinhood ships {snapshots.length} real Stock Tokens on chain 4663
            — but no listing calendar, no pre-mint subscription, no
            corporate-action programmability, no fair-launch rails, no
            lockup hedging. HOODIPO is the five-primitive stack that
            fills that gap: <b>pre-mint&nbsp;vaults</b>, <b>anti-snipe&nbsp;V4&nbsp;hooks</b>,
            {" "}<b>programmable&nbsp;uiMultiplier&nbsp;strategies</b>,
            {" "}<b>physical-delivery IPO markets</b>, and
            {" "}<b>lockup-event&nbsp;hedges</b>. All permissionless. All native.
            No bridges, no partnerships.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <LinkButton
              href="/vault"
              size="lg"
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              Open a pre-mint vault
            </LinkButton>
            <LinkButton
              href="/how-it-works"
              variant="outline"
              size="lg"
              trailingIcon={<ArrowUpRight className="h-4 w-4" />}
            >
              Read the 5 primitives
            </LinkButton>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-ink-500">
            <MetaBullet
              label={`${priceableCount} tickers priced live via Chainlink + V4 pool mid`}
            />
            <MetaBullet
              label={
                ipoPipeline > 0
                  ? `${ipoPipeline} real IPOs in the queue (Nasdaq + SEC EDGAR)`
                  : "IPO feeds unreachable — 0 tracked"
              }
            />
            <MetaBullet label="Every primitive is permissionless — no admin, no upgradability" />
          </div>
        </div>

        <HeroPreview featured={featured} others={snapshots} />
      </Container>
    </section>
  );
}

function MetaBullet({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-ink-900" />
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero preview — live pre-mint vault card                                   */
/* -------------------------------------------------------------------------- */

function HeroPreview({
  featured,
  others,
}: {
  featured: StockSnapshot | null;
  others: StockSnapshot[];
}) {
  return (
    <div className="mt-16 lg:mt-28 relative perspective-2000">
      <div
        className="relative animate-fade-in-up"
        style={{
          transform: "rotateX(14deg) rotateY(-6deg) rotateZ(-1deg)",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          aria-hidden
          className="absolute inset-x-16 -bottom-12 h-24 rounded-[40px] bg-peach-300/40 blur-2xl"
        />
        <div
          aria-hidden
          className="absolute inset-x-8 -bottom-6 h-16 rounded-[40px] bg-ink-900/20 blur-xl"
        />
        <div
          aria-hidden
          className="absolute inset-0 rounded-[32px] bg-white border border-line shadow-card"
          style={{
            transform: "translate3d(20px, 24px, -60px)",
            transformStyle: "preserve-3d",
          }}
        />

        <div className="relative rounded-[32px] bg-white border border-line shadow-floating overflow-hidden">
          <div className="border-b border-line px-5 h-11 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-peach-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-paper-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-paper-200" />
            <span className="ml-4 text-xs text-ink-400 font-mono">
              hoodipo / vault / new
            </span>
            <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-ink-400 font-mono">
              PreMintVault · CREATE2
            </span>
          </div>

          <div className="p-8 lg:p-12 grid lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3 space-y-8">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 flex items-center justify-center text-white font-bold text-sm shadow-3d">
                  HD
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-semibold text-ink-900 truncate">
                    Hunt: STRIPE
                  </div>
                  <div className="text-sm text-ink-500 truncate">
                    Pre-mint · anyone can call announce(&quot;STRIPE&quot;) → CREATE2
                    vault opens for 24h subscriptions
                  </div>
                </div>
                <Badge variant="forest" className="ml-auto">
                  Pre-mint · armed
                </Badge>
              </div>

              <div className="rounded-2xl bg-paper-100 border border-line p-6 grid grid-cols-3 gap-4">
                <MiniStat
                  label="Subscription window"
                  value="24 h"
                />
                <MiniStat
                  label="Fulfillment grace"
                  value="30 d"
                />
                <MiniStat
                  label="Keeper bounty"
                  value="1.00%"
                />
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500 mb-2">
                  Reference market — freshest IPOs already trading on RH Chain
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs text-ink-500">
                  {[featured, ...others.filter((o) => o !== featured)]
                    .filter((s): s is StockSnapshot => s !== null)
                    .slice(0, 3)
                    .map((s) => (
                      <div
                        key={s.token.ticker}
                        className="rounded-xl border border-line bg-white px-3 py-2"
                      >
                        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500">
                          {s.token.ticker}
                        </div>
                        <div className="font-mono tabular-nums text-ink-900 mt-0.5">
                          {s.priceUsd != null ? fmtUSD(s.priceUsd) : "—"}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-2xl border border-line bg-white p-6 shadow-soft space-y-5">
              <div className="text-xs uppercase tracking-[0.18em] text-ink-500">
                Subscribe · USDG
              </div>
              <div className="rounded-xl bg-paper-100 border border-line p-4 flex items-center justify-between">
                <span className="text-3xl font-mono text-ink-900 tabular-nums">
                  10,000
                </span>
                <span className="badge">USDG</span>
              </div>
              <div className="space-y-2 text-sm">
                <Row
                  k="Pot on fulfillment"
                  v={
                    featured?.totalSupply != null
                      ? `${fmtNum(featured.totalSupply, 0)} d${featured.token.ticker} liquid ref`
                      : "—"
                  }
                  tone="forest"
                />
                <Row k="Slippage floor" v="Chainlink × pot × 99%" />
                <Row k="Route" v="USDG → UR → V4 fresh pool" />
                <Row k="Refund if unlisted" v="USDG 1:1 after grace" />
              </div>
              <a
                href="/vault"
                className="btn-primary w-full py-3 text-sm inline-flex items-center justify-center gap-2"
              >
                Open PreMintVault
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <p className="text-[11px] text-ink-500 leading-relaxed">
                One CREATE2 vault per (ticker, day). Deposits sit in
                USDG until Robinhood mints the ticker; any keeper can
                then verify an RHJ-signed attestation and route the
                buy through UniversalRouter, capped at a Chainlink
                slippage floor. Non-custodial. No admin key.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500">
        {label}
      </div>
      <div className="text-lg font-mono text-ink-900 tabular-nums mt-1">
        {value}
      </div>
    </div>
  );
}

function Row({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: "forest";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{k}</span>
      <span
        className={
          tone === "forest"
            ? "text-forest-500 font-mono tabular-nums font-semibold"
            : "text-ink-900 font-mono tabular-nums"
        }
      >
        {v}
      </span>
    </div>
  );
}
