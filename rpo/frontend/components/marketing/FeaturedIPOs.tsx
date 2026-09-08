import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight, ArrowUpRight } from "@/components/ui/Icons";

type IPO = {
  ticker: string;
  name: string;
  status: "Subscribing" | "Announced" | "Fulfilled";
  target: string;
  progress: number;
  expectedPrice: string;
  countdown: string;
};

const IPOS: IPO[] = [
  {
    ticker: "STRIPE",
    name: "Stripe, Inc.",
    status: "Subscribing",
    target: "$5.00M",
    progress: 46,
    expectedPrice: "$85.20",
    countdown: "3d 4h",
  },
  {
    ticker: "KLARNA",
    name: "Klarna Bank AB",
    status: "Subscribing",
    target: "$3.00M",
    progress: 15,
    expectedPrice: "$32.00",
    countdown: "8d 0h",
  },
  {
    ticker: "REDDIT",
    name: "Reddit, Inc.",
    status: "Announced",
    target: "$4.00M",
    progress: 28,
    expectedPrice: "$47.00",
    countdown: "12d 0h",
  },
];

export function FeaturedIPOs() {
  return (
    <Section id="ipos">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-16 gap-6">
        <div className="max-w-2xl">
          <div className="eyebrow mb-5">Featured IPOs</div>
          <h2 className="font-display text-display-sm text-ink-900">
            The next tokenized listings, ready to subscribe.
          </h2>
        </div>
        <LinkButton
          href="/app"
          variant="outline"
          size="md"
          trailingIcon={<ArrowRight className="h-4 w-4" />}
        >
          Open IPO calendar
        </LinkButton>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {IPOS.map((ipo) => (
          <IPOPreviewCard key={ipo.ticker} ipo={ipo} />
        ))}
      </div>
    </Section>
  );
}

function IPOPreviewCard({ ipo }: { ipo: IPO }) {
  return (
    <Link
      href={`/app/ipo/${ipo.ticker.toLowerCase()}`}
      className="card-hover p-8 flex flex-col gap-6 group"
    >
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 flex items-center justify-center text-white text-sm font-semibold">
          {ipo.ticker.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold text-ink-900">{ipo.ticker}</div>
          <div className="text-xs text-ink-500 truncate">{ipo.name}</div>
        </div>
        <Badge
          variant={ipo.status === "Subscribing" ? "forest" : "default"}
          dot={ipo.status === "Subscribing"}
        >
          {ipo.status}
        </Badge>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-ink-500 mb-2">
          <span>Subscribed</span>
          <span className="font-mono text-ink-900 tabular-nums">
            {ipo.progress}% · {ipo.target}
          </span>
        </div>
        <div className="h-1.5 bg-paper-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-forest-500 to-peach-500"
            style={{ width: `${ipo.progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm border-t border-line pt-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500">
            Expected
          </div>
          <div className="font-mono text-ink-900 tabular-nums mt-1">
            {ipo.expectedPrice}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500">
            Launch in
          </div>
          <div className="font-mono text-forest-500 tabular-nums mt-1 font-semibold">
            {ipo.countdown}
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-ink-400 group-hover:text-ink-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>
    </Link>
  );
}
