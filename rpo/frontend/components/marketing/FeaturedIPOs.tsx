import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight, ArrowUpRight } from "@/components/ui/Icons";
import { ALL_LIVE, TOTAL_LIVE } from "@/lib/catalog";
import { fmtUSD } from "@/lib/format";

/**
 * When the protocol is live, this section surfaces the top-6 currently
 * open vaults sourced from the catalog (which itself is empty until
 * PROTOCOL_LIVE is true). Pre-launch it renders an honest empty state.
 */
const featured = [...ALL_LIVE]
  .sort((a, b) => b.targetUSD - a.targetUSD)
  .slice(0, 6);

function staticLabel(offsetSec: number, alwaysOn: boolean): string {
  if (alwaysOn) return "Always-on";
  if (offsetSec <= 0) return "Live now";
  const d = Math.floor(offsetSec / 86400);
  const h = Math.floor((offsetSec % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h`;
}

export function FeaturedIPOs() {
  if (featured.length === 0) {
    return (
      <Section id="ipos">
        <div className="max-w-2xl">
          <div className="eyebrow mb-5">Featured today</div>
          <h2 className="font-display text-display-sm text-ink-900">
            No live vaults yet.
          </h2>
          <p className="text-sm text-ink-500 mt-4 max-w-xl">
            The protocol has not been deployed on mainnet. Once contracts
            are live, this section will surface the biggest live vaults
            sampled directly from{" "}
            <code className="text-ink-900">IPORegistry.getAll()</code>.
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
          <div className="eyebrow mb-5">Featured today</div>
          <h2 className="font-display text-display-sm text-ink-900">
            Six of {TOTAL_LIVE} live vaults, right now.
          </h2>
          <p className="text-sm text-ink-500 mt-4 max-w-xl">
            Handpicked from today&apos;s board — biggest targets across all
            four deal-flow pipelines. Full catalog on{" "}
            <Link href="/app" className="text-forest-500 hover:underline">
              /app
            </Link>
            .
          </p>
        </div>
        <LinkButton
          href="/app"
          variant="outline"
          size="md"
          trailingIcon={<ArrowRight className="h-4 w-4" />}
        >
          Browse all {TOTAL_LIVE} vaults
        </LinkButton>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {featured.map((ipo) => (
          <IPOPreviewCard
            key={ipo.ticker}
            ticker={ipo.ticker}
            name={ipo.name}
            status={ipo.status as "Subscribing" | "Announced"}
            source={ipo.source}
            target={fmtUSD(ipo.targetUSD, { compact: true })}
            progress={Math.round(
              (ipo.seedSubscribedUSD / ipo.targetUSD) * 100
            )}
            expectedPrice={`$${ipo.expectedPrice.toFixed(
              ipo.expectedPrice < 1 ? 4 : 2
            )}`}
            countdown={staticLabel(ipo.launchOffsetSec, !!ipo.alwaysOn)}
          />
        ))}
      </div>
    </Section>
  );
}

function IPOPreviewCard(props: {
  ticker: string;
  name: string;
  status: "Subscribing" | "Announced";
  source: string;
  target: string;
  progress: number;
  expectedPrice: string;
  countdown: string;
}) {
  return (
    <Link
      href={`/app/ipo/${props.ticker.toLowerCase()}`}
      className="card-hover p-8 flex flex-col gap-6 group"
    >
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 flex items-center justify-center text-white text-sm font-semibold">
          {props.ticker.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold text-ink-900">
            {props.ticker}
          </div>
          <div className="text-xs text-ink-500 truncate">{props.name}</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 mt-1 font-mono">
            {props.source}
          </div>
        </div>
        <Badge
          variant={props.status === "Subscribing" ? "forest" : "default"}
          dot={props.status === "Subscribing"}
        >
          {props.status}
        </Badge>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-ink-500 mb-2">
          <span>Subscribed</span>
          <span className="font-mono text-ink-900 tabular-nums">
            {props.progress}% · {props.target}
          </span>
        </div>
        <div className="h-1.5 bg-paper-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-forest-500 to-peach-500"
            style={{ width: `${props.progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm border-t border-line pt-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500">
            Expected
          </div>
          <div className="font-mono text-ink-900 tabular-nums mt-1">
            {props.expectedPrice}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500">
            Launch in
          </div>
          <div className="font-mono text-forest-500 tabular-nums mt-1 font-semibold">
            {props.countdown}
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-ink-400 group-hover:text-ink-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>
    </Link>
  );
}
