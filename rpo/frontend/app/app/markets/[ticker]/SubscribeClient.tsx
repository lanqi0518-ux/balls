"use client";

import Link from "next/link";
import { BuyPanel } from "@/components/app/BuyPanel";
import { Badge } from "@/components/ui/Badge";
import { Bolt, Check, Lock, Shield } from "@/components/ui/Icons";
import { fmtNum, fmtUSD } from "@/lib/format";
import type { StockToken } from "@/lib/robinhood/tokens";
import { V4_POOLS } from "@/lib/robinhood/v4";

const EXPLORER_BASE = "https://robinscan.com/address/";

export function SubscribeClient({
  token,
  priceUsd,
  totalSupply,
  priceUpdatedAt,
  priceSource,
}: {
  token: StockToken;
  priceUsd: number | null;
  totalSupply: number | null;
  priceUpdatedAt: number | null;
  priceSource: "chainlink" | "pool-mid" | "unavailable";
}) {
  const ticker = token.ticker;
  const pool = V4_POOLS[ticker.toUpperCase() as keyof typeof V4_POOLS];

  const mktCap =
    priceUsd != null && totalSupply != null ? priceUsd * totalSupply : null;
  const priceAgeSec = priceUpdatedAt
    ? Math.max(0, Math.floor(Date.now() / 1000) - priceUpdatedAt)
    : null;

  return (
    <div className="p-5 lg:p-10 max-w-6xl">
      <Link
        href="/app"
        className="text-sm text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 mb-8"
      >
        ← Back to markets
      </Link>

      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="card p-8">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-700 flex items-center justify-center text-white font-bold text-lg">
                {ticker.slice(0, 4)}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-ink-900">
                  {token.name}
                </h1>
                <div className="text-sm text-ink-500 truncate">
                  d{ticker} · {token.assetClass} · Robinhood Chain
                </div>
              </div>
              <Badge
                variant={priceUsd != null ? "forest" : "peach"}
                dot={priceUsd != null}
                className="ml-auto"
              >
                {priceUsd != null ? "Live" : "RPC down"}
              </Badge>
            </div>

            <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
              <Stat
                k={priceSource === "chainlink" ? "Chainlink mark" : "V4 pool mid"}
                v={priceUsd != null ? fmtUSD(priceUsd) : "—"}
              />
              <Stat
                k="On-chain supply"
                v={
                  totalSupply != null
                    ? `${fmtNum(totalSupply, 0)} d${ticker}`
                    : "—"
                }
              />
              <Stat
                k="Market value"
                v={
                  mktCap != null
                    ? mktCap >= 1_000_000
                      ? `$${(mktCap / 1_000_000).toFixed(2)}M`
                      : mktCap >= 1_000
                      ? `$${(mktCap / 1_000).toFixed(1)}k`
                      : fmtUSD(mktCap)
                    : "—"
                }
              />
              <Stat
                k={priceSource === "chainlink" ? "Feed age" : "Price source"}
                v={
                  priceSource === "chainlink"
                    ? priceAgeSec != null
                      ? priceAgeSec < 60
                        ? `${priceAgeSec}s`
                        : priceAgeSec < 3600
                        ? `${Math.floor(priceAgeSec / 60)}m`
                        : `${Math.floor(priceAgeSec / 3600)}h`
                      : "—"
                    : priceSource === "pool-mid"
                    ? "Uni V4"
                    : "—"
                }
                tone="forest"
              />
            </div>

            <div className="mt-6 pt-6 border-t border-line grid grid-cols-2 gap-6 text-xs">
              <div>
                <div className="uppercase tracking-[0.14em] text-ink-500 mb-1">
                  Stock Token address
                </div>
                <a
                  href={`${EXPLORER_BASE}${token.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-forest-500 hover:underline truncate block"
                  title={token.address}
                >
                  {token.address.slice(0, 10)}…{token.address.slice(-6)}
                </a>
              </div>
              {token.priceFeed ? (
                <div>
                  <div className="uppercase tracking-[0.14em] text-ink-500 mb-1">
                    Chainlink feed
                  </div>
                  <a
                    href={`${EXPLORER_BASE}${token.priceFeed}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-forest-500 hover:underline truncate block"
                    title={token.priceFeed}
                  >
                    {token.priceFeed.slice(0, 10)}…
                    {token.priceFeed.slice(-6)}
                  </a>
                </div>
              ) : (
                <div>
                  <div className="uppercase tracking-[0.14em] text-ink-500 mb-1">
                    Price source
                  </div>
                  <div className="font-mono text-ink-900">
                    Uniswap V4 pool mid
                  </div>
                </div>
              )}
              {pool && (
                <>
                  <div>
                    <div className="uppercase tracking-[0.14em] text-ink-500 mb-1">
                      Uniswap V4 pool id
                    </div>
                    <a
                      href={`${EXPLORER_BASE}0x8366a39cc670b4001a1121b8f6a443a643e40951`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-forest-500 hover:underline truncate block"
                      title={pool.poolId}
                    >
                      {pool.poolId.slice(0, 10)}…{pool.poolId.slice(-6)}
                    </a>
                  </div>
                  <div>
                    <div className="uppercase tracking-[0.14em] text-ink-500 mb-1">
                      Pool config
                    </div>
                    <div className="font-mono text-ink-900">
                      fee{" "}
                      {pool.poolKey.fee === 8388608
                        ? "dyn"
                        : `${(pool.poolKey.fee / 10000).toFixed(3)}%`}{" "}
                      · ts {pool.poolKey.tickSpacing}
                      {pool.poolKey.hooks !==
                      "0x0000000000000000000000000000000000000000"
                        ? " · hook"
                        : ""}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card p-8">
            <h2 className="text-lg font-semibold text-ink-900 mb-4">
              What you&apos;re actually buying
            </h2>
            <p className="text-xs text-ink-500 mb-4 leading-relaxed">
              d{ticker} is not a new IPO — it&apos;s an already-listed
              public {token.assetClass === "ETF" ? "ETF" : "stock"}{" "}
              Robinhood has already minted onto Robinhood Chain as
              an aftermarket Stock Token. When you buy, your USDG is
              routed{" "}
              <span className="font-mono">USDG → Permit2 → UR → Uniswap V4</span>{" "}
              and the pool sends you real d{ticker} on the same block:
            </p>
            <ul className="space-y-3 text-sm text-ink-500">
              {[
                `A Reg-S debt security issued by Robinhood Assets (Jersey), redeemable 1:1 against 1 share of ${ticker}. Already trading on Robinhood Chain and quoted through the pool above.`,
                "Standard 18-decimal ERC-20 — dividends and splits are applied automatically via uiMultiplier updates on the token contract.",
                token.priceFeed
                  ? "Priced through the on-chain Chainlink feed shown above; the V4 pool tracks that feed via arbitrage."
                  : "Reference price comes from the V4 pool mid; arbitrage keeps it aligned with the Chainlink feed Robinhood publishes for the underlying.",
                "Not available to U.S., Canadian, U.K., Swiss, or U.A.E. residents per RHJ's Reg-S terms.",
              ].map((l) => (
                <li key={l} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-forest-500 mt-0.5 flex-shrink-0" />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <Guarantee
              Icon={Bolt}
              title="Instant fill"
              body="One tx — no batch window, no waitlist."
            />
            <Guarantee
              Icon={Shield}
              title="Non-custodial"
              body="Uniswap V4 PoolManager holds pool state; UR only routes."
            />
            <Guarantee
              Icon={Lock}
              title="Slippage floor"
              body="Tx reverts if you'd receive less than min-out."
            />
          </div>
        </div>

        <aside className="lg:col-span-2">
          <BuyPanel token={token} priceUsd={priceUsd} />
        </aside>
      </div>
    </div>
  );
}

function Stat({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: "forest";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500">
        {k}
      </div>
      <div
        className={
          "text-xl font-mono tabular-nums mt-1 " +
          (tone === "forest" ? "text-forest-500" : "text-ink-900")
        }
      >
        {v}
      </div>
    </div>
  );
}

function Guarantee({
  Icon,
  title,
  body,
}: {
  Icon: (props: { className?: string }) => JSX.Element;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-5">
      <Icon className="h-4 w-4 text-forest-500 mb-3" />
      <div className="text-sm font-semibold text-ink-900">{title}</div>
      <div className="text-xs text-ink-500 mt-1 leading-relaxed">{body}</div>
    </div>
  );
}
