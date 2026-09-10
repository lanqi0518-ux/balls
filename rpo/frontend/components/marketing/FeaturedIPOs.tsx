import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight, ArrowUpRight } from "@/components/ui/Icons";
import { readAllStockSnapshots } from "@/lib/robinhood/reads";
import { fmtNum, fmtUSD } from "@/lib/format";

/**
 * Featured section — real, live Robinhood-Chain Stock Tokens sourced
 * from the RPC on every ISR revalidation. These are the underlying
 * assets an RPO SubscriptionVault will buy when the protocol goes
 * live. The subscribe surface is gated on the RPO vault being
 * deployed; the underlying market data is real either way.
 */
export async function FeaturedIPOs() {
  const snapshots = await readAllStockSnapshots();
  const rankedByCap = [...snapshots]
    .filter((s) => s.priceUsd != null && s.totalSupply != null)
    .sort((a, b) => (b.priceUsd! * b.totalSupply!) - (a.priceUsd! * a.totalSupply!));
  const featured = rankedByCap.slice(0, 6);

  if (featured.length === 0) {
    return (
      <Section id="ipos">
        <div className="max-w-2xl">
          <div className="eyebrow mb-5">Underlying markets</div>
          <h2 className="font-display text-display-sm text-ink-900">
            Robinhood Chain RPC unreachable.
          </h2>
          <p className="text-sm text-ink-500 mt-4 max-w-xl">
            The site could not fetch live Chainlink prices from{" "}
            <code className="text-ink-900">
              rpc.mainnet.chain.robinhood.com
            </code>
            . Once the RPC is reachable, this section surfaces every
            deployed Robinhood Stock Token with its live mark and
            on-chain supply — no fake data will ever be displayed.
          </p>
          <div className="mt-8">
            <LinkButton
              href="/app"
              variant="outline"
              size="md"
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              Open the app
            </LinkButton>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section id="ipos">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-16 gap-6">
        <div className="max-w-2xl">
          <div className="eyebrow mb-5">Underlying markets · live</div>
          <h2 className="font-display text-display-sm text-ink-900">
            Real Robinhood-Chain Stock Tokens, priced by Chainlink.
          </h2>
          <p className="text-sm text-ink-500 mt-4 max-w-xl">
            These are already deployed on Robinhood Chain (id 4663).
            When an RPO SubscriptionVault ships, its fill leg buys the
            underlying token directly from Rialto propAMM. Marks below
            come from the on-chain Chainlink feeds and refresh every 60
            seconds.
          </p>
        </div>
        <LinkButton
          href="/explorer"
          variant="outline"
          size="md"
          trailingIcon={<ArrowRight className="h-4 w-4" />}
        >
          Full onchain explorer
        </LinkButton>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {featured.map((s) => (
          <UnderlyingCard
            key={s.token.ticker}
            ticker={s.token.ticker}
            name={s.token.name}
            priceUsd={s.priceUsd!}
            totalSupply={s.totalSupply!}
            updatedAt={s.updatedAt}
            assetClass={s.token.assetClass}
          />
        ))}
      </div>
    </Section>
  );
}

function UnderlyingCard(props: {
  ticker: string;
  name: string;
  priceUsd: number;
  totalSupply: number;
  updatedAt: number | null;
  assetClass: string;
}) {
  const marketCap = props.priceUsd * props.totalSupply;
  const ageSec = props.updatedAt
    ? Math.max(0, Math.floor(Date.now() / 1000) - props.updatedAt)
    : null;
  return (
    <Link
      href={`/app/ipo/${props.ticker.toLowerCase()}`}
      className="card-hover p-8 flex flex-col gap-6 group"
    >
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 flex items-center justify-center text-white text-sm font-semibold">
          {props.ticker.slice(0, 4)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold text-ink-900">
            {props.ticker}
          </div>
          <div className="text-xs text-ink-500 truncate">{props.name}</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 mt-1 font-mono">
            {props.assetClass} · Chainlink
          </div>
        </div>
        <Badge variant="forest" dot>
          Live
        </Badge>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-ink-500 mb-2">
          <span>Chainlink mark</span>
          <span className="font-mono text-ink-900 tabular-nums">
            {fmtUSD(props.priceUsd)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-ink-500 mt-1">
          <span>On-chain supply</span>
          <span className="font-mono text-ink-900 tabular-nums">
            {fmtNum(props.totalSupply, 0)} d{props.ticker}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-ink-500 mt-1">
          <span>Market value</span>
          <span className="font-mono text-ink-900 tabular-nums">
            {marketCap >= 1_000_000
              ? `$${(marketCap / 1_000_000).toFixed(2)}M`
              : marketCap >= 1_000
              ? `$${(marketCap / 1_000).toFixed(1)}k`
              : fmtUSD(marketCap)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm border-t border-line pt-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500">
            Feed updated
          </div>
          <div className="font-mono text-ink-900 tabular-nums mt-1">
            {ageSec != null
              ? ageSec < 60
                ? `${ageSec}s ago`
                : ageSec < 3600
                ? `${Math.floor(ageSec / 60)}m ago`
                : `${Math.floor(ageSec / 3600)}h ago`
              : "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500">
            Ticker
          </div>
          <div className="font-mono text-forest-500 tabular-nums mt-1 font-semibold">
            d{props.ticker}
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-ink-400 group-hover:text-ink-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>
    </Link>
  );
}
