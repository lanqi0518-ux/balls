import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight, ArrowUpRight, Circle } from "@/components/ui/Icons";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 lg:pt-24 pb-24 lg:pb-32">
      <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
      <div className="absolute inset-0 grid-bg pointer-events-none" />

      <Container className="relative">
        <div className="max-w-4xl">
          <Badge variant="mint" dot className="mb-6">
            Live on Robinhood Chain · Chain ID 4663
          </Badge>

          <h1 className="font-display text-display-lg text-fg">
            The permissionless{" "}
            <span className="italic text-mint-500">IPO subscription</span>{" "}
            protocol.
          </h1>

          <p className="mt-8 text-xl text-fg-muted max-w-2xl leading-relaxed">
            Subscribe to real IPOs on-chain. No broker. No KYC. In 20
            seconds. Priced through Rialto propAMM, allocated pro-rata,
            settled the moment Robinhood mints a Stock Token.
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

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-fg-muted">
            <span className="inline-flex items-center gap-2">
              <Circle className="h-1.5 w-1.5 fill-mint-500 text-mint-500" />
              12 IPOs subscribed to date
            </span>
            <span className="inline-flex items-center gap-2">
              <Circle className="h-1.5 w-1.5 fill-mint-500 text-mint-500" />
              $8.4M cumulative volume
            </span>
            <span className="inline-flex items-center gap-2">
              <Circle className="h-1.5 w-1.5 fill-mint-500 text-mint-500" />
              0 seized allocations · 0 rugs
            </span>
          </div>
        </div>

        <HeroPreview />
      </Container>
    </section>
  );
}

function HeroPreview() {
  return (
    <div className="mt-16 lg:mt-24 relative">
      <div className="absolute -inset-x-8 -inset-y-4 bg-mint-500/[0.03] blur-3xl pointer-events-none" />
      <div className="relative rounded-3xl border border-line-strong bg-ink-800/60 backdrop-blur-sm p-4 shadow-floating">
        <div className="rounded-2xl border border-line bg-ink-900 overflow-hidden">
          <div className="border-b border-line px-4 h-9 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-ink-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-ink-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-ink-600" />
            <span className="ml-4 text-xs text-fg-dim font-mono">
              app.rpo.xyz/ipo/STRIPE
            </span>
          </div>
          <div className="p-6 lg:p-10 grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-mint-500 to-mint-400 flex items-center justify-center text-ink-950 font-bold text-lg">
                  ST
                </div>
                <div>
                  <div className="text-2xl font-semibold text-fg">
                    Stripe, Inc.
                  </div>
                  <div className="text-sm text-fg-muted">
                    dSTRIPE · Reg-S Stock Token · underlying: 1 STRIPE share
                  </div>
                </div>
                <Badge variant="mint" dot className="ml-auto">
                  Subscribing
                </Badge>
              </div>

              <div className="rounded-xl border border-line bg-ink-800 p-5 grid grid-cols-3 gap-4">
                <MiniStat label="Expected price" value="$85.20" />
                <MiniStat label="Subscribed" value="$2.31M" />
                <MiniStat label="Target" value="$5.00M" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-fg-muted">
                  <span>Progress</span>
                  <span className="font-mono">46%</span>
                </div>
                <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden">
                  <div
                    className="h-full bg-mint-gradient"
                    style={{ width: "46%" }}
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-xl border border-line-strong bg-ink-800 p-5 space-y-4">
              <div className="text-sm text-fg-muted">Subscription</div>
              <div className="rounded-lg bg-ink-900 border border-line p-3 flex items-center justify-between">
                <input
                  className="bg-transparent text-2xl font-mono text-fg outline-none w-full"
                  defaultValue="500"
                  readOnly
                />
                <span className="text-xs text-fg-muted">USDG</span>
              </div>
              <div className="space-y-1.5 text-sm">
                <Row k="Allocation" v="~ 5.88 dSTRIPE" />
                <Row k="Boost" v="2.5×" tone="mint" />
                <Row k="Fee (2%)" v="$10.00" />
                <Row k="Refund if unfilled" v="100%" />
              </div>
              <button className="btn-primary w-full py-3 text-sm">
                Subscribe · 20s
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
      <div className="text-[10px] uppercase tracking-[0.14em] text-fg-dim">
        {label}
      </div>
      <div className="text-lg font-mono text-fg tabular-nums mt-1">
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
  tone?: "mint";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg-muted">{k}</span>
      <span
        className={
          tone === "mint"
            ? "text-mint-400 font-mono"
            : "text-fg font-mono"
        }
      >
        {v}
      </span>
    </div>
  );
}
