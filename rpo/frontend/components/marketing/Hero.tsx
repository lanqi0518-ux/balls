import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Sphere } from "@/components/ui/Sphere";
import { ArrowRight, ArrowUpRight } from "@/components/ui/Icons";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 lg:pt-32 pb-20 lg:pb-40">
      {/* Warm mesh gradient — the "wow" layer */}
      <div className="absolute inset-0 bg-mesh-warm opacity-90 pointer-events-none" />
      <div className="absolute inset-0 grid-bg pointer-events-none" />

      {/* Floating 3D orbs */}
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
            Pre-launch · designed for Robinhood Chain (id 4663)
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
            Subscribe to real IPOs on-chain. No broker. No KYC. Priced
            through Rialto propAMM, allocated pro-rata, settled the moment
            Robinhood mints a Stock Token. Contracts are ready; addresses go
            live the moment $RPO launches on Pons.
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
            <MetaBullet label="Contracts on GitHub" />
            <MetaBullet label="Testnet faucet available" />
            <MetaBullet label="No mainnet deploy yet" />
          </div>
        </div>

        <HeroPreview />
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
/*  Hero preview — a full app card, tilted in 3D perspective                  */
/* -------------------------------------------------------------------------- */

function HeroPreview() {
  return (
    <div className="mt-16 lg:mt-28 relative perspective-2000">
      <div
        className="relative animate-fade-in-up"
        style={{
          transform: "rotateX(14deg) rotateY(-6deg) rotateZ(-1deg)",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Stacked shadow layers for depth */}
        <div
          aria-hidden
          className="absolute inset-x-16 -bottom-12 h-24 rounded-[40px] bg-peach-300/40 blur-2xl"
        />
        <div
          aria-hidden
          className="absolute inset-x-8 -bottom-6 h-16 rounded-[40px] bg-ink-900/20 blur-xl"
        />

        {/* Second card behind (isometric stack) */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-[32px] bg-white border border-line shadow-card"
          style={{
            transform: "translate3d(20px, 24px, -60px)",
            transformStyle: "preserve-3d",
          }}
        />

        {/* Main card */}
        <div className="relative rounded-[32px] bg-white border border-line shadow-floating overflow-hidden">
          {/* Chrome */}
          <div className="border-b border-line px-5 h-11 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-peach-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-paper-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-paper-200" />
            <span className="ml-4 text-xs text-ink-400 font-mono">
              app / ipo / EXAMPLE
            </span>
            <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-ink-400 font-mono">
              interface preview
            </span>
          </div>

          <div className="p-8 lg:p-12 grid lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3 space-y-8">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 flex items-center justify-center text-white font-bold shadow-3d">
                  EX
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-semibold text-ink-900 truncate">
                    Example Issuer
                  </div>
                  <div className="text-sm text-ink-500">
                    dEXAMPLE · Reg-S · UI preview only
                  </div>
                </div>
                <Badge variant="peach" className="ml-auto">
                  Preview
                </Badge>
              </div>

              <div className="rounded-2xl bg-paper-100 border border-line p-6 grid grid-cols-3 gap-4">
                <MiniStat label="Expected" value="—" />
                <MiniStat label="Subscribed" value="—" />
                <MiniStat label="Target" value="—" />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-ink-500 mb-2">
                  <span>Progress</span>
                  <span className="font-mono tabular-nums text-ink-900">—</span>
                </div>
                <div className="h-2 rounded-full bg-paper-200 overflow-hidden">
                  <div className="h-full rounded-full bg-paper-200" style={{ width: "0%" }} />
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-2xl border border-line bg-white p-6 shadow-soft space-y-5">
              <div className="text-xs uppercase tracking-[0.18em] text-ink-500">
                Subscription
              </div>
              <div className="rounded-xl bg-paper-100 border border-line p-4 flex items-center justify-between">
                <span className="text-3xl font-mono text-ink-400 tabular-nums">
                  0
                </span>
                <span className="badge">USDG</span>
              </div>
              <div className="space-y-2 text-sm">
                <Row k="Allocation" v="—" />
                <Row k="Boost" v="1.00×" tone="forest" />
                <Row k="Fee (2%)" v="—" />
                <Row k="Refund" v="100%" />
              </div>
              <button
                disabled
                className="btn-primary w-full py-3 text-sm opacity-60 cursor-not-allowed"
              >
                Preview only — no live vault
              </button>
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
