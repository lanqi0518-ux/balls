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
 * Hero is an async Server Component: it fetches live Robinhood Chain
 * data (Chainlink prices + ERC-20 supply for real deployed Stock
 * Tokens) at render time. No simulation, no preview labels. If the
 * RPC fails, we render an honest "market data unavailable" fallback.
 */
export async function Hero() {
  const [snapshots, ipoCal] = await Promise.all([
    readAllStockSnapshots(),
    readGlobalIpoCalendar(),
  ]);
  const featured =
    snapshots.find((s) => s.token.ticker === "NVDA" && s.priceUsd != null) ??
    snapshots.find((s) => s.priceUsd != null) ??
    snapshots[0] ??
    null;
  const ipoPipeline =
    ipoCal.upcoming.length + ipoCal.priced.length + ipoCal.filed.length;

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
            Live on Robinhood Chain (id 4663) · RPO contracts pending audit
          </Badge>

          <h1 className="font-display text-display-lg text-ink-900">
            The permissionless{" "}
            <span
              className="italic"
              style={{ fontVariationSettings: "'SOFT' 100, 'opsz' 144" }}
            >
              IPO&nbsp;subscription
            </span>{" "}
            protocol.
          </h1>

          <p className="mt-8 text-xl text-ink-500 max-w-2xl leading-relaxed">
            Subscribe to Robinhood Stock Tokens on-chain — new IPO listings
            <em> and </em> the already-live aftermarket book. Priced through
            Rialto propAMM, allocated pro-rata, settled the moment Robinhood
            mints. Today the preview below shows a real aftermarket token
            (Robinhood has not minted any new IPO listings yet).
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <LinkButton
              href="/app"
              size="lg"
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              Launch app
            </LinkButton>
            <LinkButton
              href="/how-it-works"
              variant="outline"
              size="lg"
              trailingIcon={<ArrowUpRight className="h-4 w-4" />}
            >
              How it works
            </LinkButton>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-ink-500">
            <MetaBullet
              label={`${
                snapshots.filter((s) => s.priceUsd != null).length
              } / ${snapshots.length} aftermarket Stock Tokens live on RH Chain`}
            />
            <MetaBullet
              label={
                ipoPipeline > 0
                  ? `${ipoPipeline} real IPOs tracked live (Nasdaq + SEC EDGAR)`
                  : "IPO feeds unreachable — 0 tracked"
              }
            />
            <MetaBullet label="RPO subscription vaults pending audit" />
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
/*  Hero preview — real Robinhood-Chain Stock Token, priced live               */
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
              app / markets /{" "}
              {featured?.token.ticker.toLowerCase() ?? "—"}
            </span>
            <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-ink-400 font-mono">
              Aftermarket · live on RH Chain
            </span>
          </div>

          <div className="p-8 lg:p-12 grid lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3 space-y-8">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 flex items-center justify-center text-white font-bold text-sm shadow-3d">
                  {featured?.token.ticker ?? "—"}
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-semibold text-ink-900 truncate">
                    {featured?.token.name ?? "Awaiting live snapshot"}
                  </div>
                  <div className="text-sm text-ink-500 truncate">
                    {featured
                      ? `d${featured.token.ticker} · ${featured.token.assetClass} · Chainlink-priced`
                      : "Robinhood Chain RPC unreachable"}
                  </div>
                </div>
                <Badge variant="forest" className="ml-auto">
                  Aftermarket · live
                </Badge>
              </div>

              <div className="rounded-2xl bg-paper-100 border border-line p-6 grid grid-cols-3 gap-4">
                <MiniStat
                  label="Chainlink mark"
                  value={
                    featured?.priceUsd != null
                      ? fmtUSD(featured.priceUsd)
                      : "—"
                  }
                />
                <MiniStat
                  label="On-chain supply"
                  value={
                    featured?.totalSupply != null
                      ? fmtNum(featured.totalSupply, 0)
                      : "—"
                  }
                />
                <MiniStat
                  label="Feed decimals"
                  value={featured?.priceUsd != null ? "8" : "—"}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs text-ink-500">
                {others.slice(0, 3).map((s) => (
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

            <div className="lg:col-span-2 rounded-2xl border border-line bg-white p-6 shadow-soft space-y-5">
              <div className="text-xs uppercase tracking-[0.18em] text-ink-500">
                Aftermarket subscription
              </div>
              <div className="rounded-xl bg-paper-100 border border-line p-4 flex items-center justify-between">
                <span className="text-3xl font-mono text-ink-400 tabular-nums">
                  0
                </span>
                <span className="badge">USDG</span>
              </div>
              <div className="space-y-2 text-sm">
                <Row k="Underlying" v={featured?.token.ticker ?? "—"} />
                <Row
                  k="Chainlink mark"
                  v={
                    featured?.priceUsd != null
                      ? fmtUSD(featured.priceUsd)
                      : "—"
                  }
                />
                <Row k="Boost" v="1.00×" tone="forest" />
                <Row k="Fee (2%)" v="—" />
                <Row k="Refund" v="100%" />
              </div>
              <button
                disabled
                className="btn-primary w-full py-3 text-sm opacity-60 cursor-not-allowed"
              >
                Subscribe · waiting for RPO deploy
              </button>
              <p className="text-[11px] text-ink-500 leading-relaxed">
                This is Robinhood&apos;s aftermarket Stock Token — an
                already-listed public equity, live on Robinhood Chain
                right now. Not a new IPO. The subscribe button
                activates the moment the RPO AftermarketVault contract
                is deployed and set in NEXT_PUBLIC_REGISTRY_ADDRESS.
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
