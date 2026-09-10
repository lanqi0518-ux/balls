import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight, ArrowUpRight } from "@/components/ui/Icons";
import { readAllStockSnapshots } from "@/lib/robinhood/reads";
import { readGlobalIpoCalendar } from "@/lib/ipos/aggregate";
import { fmtNum, fmtUSD } from "@/lib/format";

/**
 * Aftermarket section — real, live Robinhood-Chain Stock Tokens sourced
 * from the RPC on every ISR revalidation. NVDA / AAPL / SPY are
 * already-listed public equities (NVDA IPO'd in 1999, AAPL in 1980,
 * SPY is a 1993 ETF); Robinhood has minted them onto Robinhood Chain
 * as Reg-S Stock Tokens. These are the aftermarket underlying — the
 * assets an RPO AftermarketVault will fill against via Rialto propAMM
 * once the vault contract ships. New IPO listings appear separately
 * when Robinhood mints them and get their own subscription vault.
 * The subscribe surface is gated on the RPO vault being deployed;
 * the underlying market data below is real either way.
 */
export async function FeaturedIPOs() {
  const [snapshots, ipoCal] = await Promise.all([
    readAllStockSnapshots(),
    readGlobalIpoCalendar(),
  ]);
  const rankedByCap = [...snapshots]
    .filter((s) => s.priceUsd != null && s.totalSupply != null)
    .sort((a, b) => (b.priceUsd! * b.totalSupply!) - (a.priceUsd! * a.totalSupply!));
  const featured = rankedByCap.slice(0, 6);
  const ipoPipeline =
    ipoCal.upcoming.length + ipoCal.priced.length + ipoCal.filed.length;

  if (featured.length === 0) {
    return (
      <Section id="markets">
        <div className="max-w-2xl">
          <div className="eyebrow mb-5">Aftermarket</div>
          <h2 className="font-display text-display-sm text-ink-900">
            Robinhood Chain RPC unreachable.
          </h2>
          <p className="text-sm text-ink-500 mt-4 max-w-xl">
            The site could not fetch live Chainlink prices from{" "}
            <code className="text-ink-900">
              rpc.mainnet.chain.robinhood.com
            </code>
            . Once the RPC is reachable, this section surfaces every
            deployed Robinhood Stock Token (aftermarket underlying)
            with its live mark and on-chain supply — no fake data will
            ever be displayed.
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
    <Section id="markets">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-6">
        <div className="max-w-2xl">
          <div className="eyebrow mb-5">Robinhood Stock Tokens · buyable now on Uniswap V4</div>
          <h2 className="font-display text-display-sm text-ink-900">
            {snapshots.length} tokenized equities live on RH&nbsp;Chain
            — <span className="text-forest-500">buy any of them right now</span>.
          </h2>
          <p className="text-sm text-ink-500 mt-4 max-w-xl">
            Recent IPOs — <strong>CRCL</strong> (Circle),{" "}
            <strong>FIG</strong> (Figma), <strong>CRWV</strong>{" "}
            (CoreWeave), <strong>FLY</strong> (Firefly),{" "}
            <strong>BULL</strong> (Webull) — plus pre-IPO{" "}
            <strong>SPCX</strong> (SpaceX) and aftermarket for every
            large-cap you&apos;d expect (NVDA, TSLA, AAPL, MSFT, META,
            SPY, GLD, …). Each has an active USDG pool on Uniswap V4:
            connect wallet → enter USDG → tx fills same block. Marks
            come from Chainlink where available, otherwise the pool
            mid; arbitrage keeps them tight.
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

      <div className="mb-10 card p-6 border-l-4 border-ink-900 bg-white flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Badge variant="dark">Primary listings · global IPO calendar</Badge>
          <div className="mt-3 text-ink-900 font-semibold">
            {ipoPipeline > 0
              ? `${ipoPipeline} real IPOs in the US listings pipeline right now.`
              : "IPO data sources unreachable — showing 0 tracked."}
          </div>
          <p className="text-sm text-ink-500 mt-2 max-w-2xl leading-relaxed">
            Every one of them is a real public filing from{" "}
            <a
              className="text-forest-500 hover:underline"
              href="https://www.nasdaq.com/market-activity/ipos"
              target="_blank"
              rel="noreferrer"
            >
              Nasdaq
            </a>{" "}
            /{" "}
            <a
              className="text-forest-500 hover:underline"
              href="https://efts.sec.gov/LATEST/search-index?q=%22initial+public+offering%22&forms=S-1%2CF-1"
              target="_blank"
              rel="noreferrer"
            >
              SEC EDGAR
            </a>
            . Robinhood hasn&apos;t minted any of these as Stock Tokens
            yet — the moment they do, the row in the global calendar
            flips to <em>Vault open</em>. Aftermarket for
            already-listed tickers is below.
          </p>
        </div>
        <LinkButton
          href="/ipos"
          variant="outline"
          size="md"
          trailingIcon={<ArrowRight className="h-4 w-4" />}
        >
          Open global IPO calendar
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
            priceSource={s.priceSource}
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
  priceSource: "chainlink" | "pool-mid" | "unavailable";
}) {
  const marketCap = props.priceUsd * props.totalSupply;
  const ageSec = props.updatedAt
    ? Math.max(0, Math.floor(Date.now() / 1000) - props.updatedAt)
    : null;
  return (
    <Link
      href={`/app/markets/${props.ticker.toLowerCase()}`}
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
            {props.assetClass} · {props.priceSource === "chainlink" ? "Chainlink" : "V4 pool mid"}
          </div>
        </div>
        <Badge variant="forest" dot>
          Live
        </Badge>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-ink-500 mb-2">
          <span>{props.priceSource === "chainlink" ? "Chainlink mark" : "V4 pool mid"}</span>
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
            {props.priceSource === "chainlink" ? "Feed updated" : "Source"}
          </div>
          <div className="font-mono text-ink-900 tabular-nums mt-1">
            {props.priceSource === "chainlink"
              ? ageSec != null
                ? ageSec < 60
                  ? `${ageSec}s ago`
                  : ageSec < 3600
                  ? `${Math.floor(ageSec / 60)}m ago`
                  : `${Math.floor(ageSec / 3600)}h ago`
                : "—"
              : "V4 pool mid"}
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
