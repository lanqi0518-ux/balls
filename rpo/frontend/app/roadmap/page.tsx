import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Prose } from "@/components/ui/Prose";
import { H2, H3 } from "@/components/ui/H";
import { Badge } from "@/components/ui/Badge";
import { CodeBlock } from "@/components/ui/CodeBlock";
import {
  Check,
  ArrowRight,
  ArrowUpRight,
  Shield,
  Bolt,
  Globe,
  Layers,
} from "@/components/ui/Icons";

export const metadata = {
  title: "Roadmap",
  description:
    "From IPO subscription to on-chain IPO issuance. RPO's four-phase plan to replace NASDAQ as the default primary market for public equities.",
};

const PHASES = [
  {
    n: "00",
    year: "Live · 2026",
    codename: "Subscribe",
    status: "shipped" as const,
    title: "Permissionless subscription to RHJ Stock Tokens",
    body:
      "The current RPO protocol: users subscribe to Robinhood Assets Jersey Reg-S Stock Tokens the moment they are listed. Priced via Rialto propAMM, allocated by $RPO-weighted staker boost, refunded permissionlessly if the underlying doesn't list.",
    who: "Any non-US wallet",
    legal: "None required — reads existing Reg-S offerings",
    modules: ["IPORegistry", "SubscriptionVault", "AssetDiscovery", "AllocationBooster", "RialtoAdapter", "LeverageLooper"],
    delivered: "March 2026",
  },
  {
    n: "00b",
    year: "Live · 2026",
    codename: "Scale",
    status: "shipped" as const,
    title: "AssetDiscovery — 200-500 vaults live every day",
    body:
      "Deploy AssetDiscovery.sol: a permissionless factory anyone can call to spawn subscription vaults for (a) every RHJ-listed stock token as an always-on aftermarket vault (rolled every 4h), and (b) every Pons Launchpad token that graduates to Uniswap V4 as a 72h subscription window. Same subscribe flow, but the calendar is never empty — connect wallet, browse hundreds of live vaults, subscribe with USDG.",
    who: "Any non-US wallet",
    legal: "None required — same Reg-S posture as Phase 00",
    modules: ["AssetDiscovery", "PonsGraduationHandler", "RhjStockTokenSet", "ChainlinkRegistry"],
    delivered: "September 2026",
  },
  {
    n: "01",
    year: "H1 2026",
    codename: "Issue · Reg-S",
    status: "next" as const,
    title: "Global-non-US IPOs, issued directly through RPO",
    body:
      "RPO becomes a primary issuance venue. Companies incorporate a Cayman / Jersey SPV, file a Reg-S offering circular, and mint ERC-8056 shares directly on Robinhood Chain — where the tokens ARE the shares, no wrapper. All non-US retail can subscribe on day 1. Global reach, single-digit-dollar minimums.",
    who: "Any non-US wallet",
    legal: "Regulation S (SEC) — no US persons",
    modules: ["IssuanceFactory", "TransferPolicy (ERC-3643)", "CapTable", "Cayman/Jersey SPV template"],
    delivered: "Target Q3 2026",
  },
  {
    n: "02",
    year: "H2 2026",
    codename: "Issue · Reg-D",
    status: "planned" as const,
    title: "Institutional issuances under Reg-D 506(c)",
    body:
      "For companies wanting unlimited raise size and US accredited-investor access, RPO adds a Reg-D 506(c) issuance path with on-chain accreditation gating via a Sumsub/Persona SBT. 12-month Rule 144 lock enforced by the transfer-policy contract. Same rails, different transfer restrictions.",
    who: "Accredited investors globally, KYC required",
    legal: "Regulation D Rule 506(c) — accredited only",
    modules: ["AccreditationSBT", "Rule144Lockup", "SecuritizeVertalo integration"],
    delivered: "Target Q4 2026",
  },
  {
    n: "03",
    year: "H1 2027",
    codename: "Issue · Reg-A+",
    status: "planned" as const,
    title: "US retail IPOs on-chain",
    body:
      "SEC-qualified Reg-A+ Tier-2 offerings, up to $75M per year per issuer. Any US retail wallet can subscribe. This is the first path where a startup 'IPOs' in the ordinary-language sense — no broker, no NASDAQ, one weekend of paperwork instead of six months of book-building. RPO acts as the qualification counsel + underwriter of record.",
    who: "US retail + global",
    legal: "Regulation A Tier 2 — SEC qualification required (~6 months, ~$500k legal)",
    modules: ["Reg-A+ prospectus DAO template", "Transfer Agent partnership", "State blue-sky auto-file"],
    delivered: "Target Q2 2027",
  },
  {
    n: "04",
    year: "H2 2027 →",
    codename: "Compete",
    status: "vision" as const,
    title: "Direct NASDAQ replacement — S-1 tokenized IPOs",
    body:
      "The end state. A full S-1 registered public offering where the shares are ERC-8056 tokens on Robinhood Chain from block 0. Trading venue is a FINRA-registered ATS operated by RPO Labs (or in partnership with an existing ATS like tZERO). Settlement is atomic on-chain, not T+2 through DTCC. Every serious IPO can choose: pay Goldman $50M, or launch on RPO for $2M.",
    who: "Every public-market participant",
    legal: "Full S-1 registration + FINRA ATS + SEC-registered Transfer Agent",
    modules: ["ATS orderbook", "In-house Transfer Agent (or Vertalo partnership)", "DTCC-alternative settlement"],
    delivered: "Target 2027 – 2028",
  },
];

const LEGAL_PATHS = [
  {
    name: "Regulation S",
    cap: "Unlimited",
    who: "Non-US persons only",
    time: "Days",
    cost: "$50k-100k",
    lock: "40-day distribution compliance",
    us: false,
    retail: true,
    live: "Today (RHJ uses this)",
  },
  {
    name: "Regulation D 506(c)",
    cap: "Unlimited",
    who: "Accredited investors globally",
    time: "Days",
    cost: "$100k-200k",
    lock: "12 months (Rule 144)",
    us: true,
    retail: false,
    live: "Today (Securitize, INX)",
  },
  {
    name: "Regulation A+ Tier 2",
    cap: "$75M / year",
    who: "US retail + global",
    time: "~6 months",
    cost: "$500k-1M",
    lock: "None post-qualification",
    us: true,
    retail: true,
    live: "Today (Exodus proved it)",
  },
  {
    name: "S-1 public IPO (tokenized)",
    cap: "Unlimited",
    who: "Everyone (via FINRA ATS)",
    time: "12+ months",
    cost: "$2-5M legal",
    lock: "180-day underwriter lock, optional",
    us: true,
    retail: true,
    live: "Needs ATS partnership",
  },
];

const PRECEDENT = [
  {
    company: "INX Limited",
    year: 2020,
    what: "First SEC-registered on-chain IPO. Raised $85M in a security-token public offering; INX common stock is a live ERC-20 today.",
  },
  {
    company: "Exodus Movement",
    year: 2021,
    what: "Reg-A+ Tier 2 offering of tokenized common shares. Class-A common stock is native on Algorand + OTCQX cross-listed. Peak market cap ~$700M.",
  },
  {
    company: "tZERO",
    year: 2018,
    what: "Overstock-incubated FINRA-registered ATS. First live venue for trading SEC-registered security tokens. Preferred equity settles on chain.",
  },
  {
    company: "Aktionariat AG (40+ Swiss AGs)",
    year: 2020,
    what: "Every Swiss AG on the platform issues its own ERC-20 share class. Trades through an on-chain AMM under the Swiss DLT Act — no regulatory ambiguity.",
  },
  {
    company: "Backed Finance / BX Swiss",
    year: 2023,
    what: "Tokenized wrappers of SPY / TSLA / NVDA under Swiss law, offered to global-non-US retail via any wallet. Direct precedent for the RHJ Stock Token model.",
  },
];

const CHAIN_ADVANTAGE = [
  {
    Icon: Bolt,
    label: "250ms blocks · 0.001 gwei gas",
    body:
      "Per-transfer cost ≈ $0.002. DTCC currently charges the industry ~$30B/year in settlement + custody fees. On-chain rails delete that line item.",
  },
  {
    Icon: Layers,
    label: "ERC-8056 uiMultiplier",
    body:
      "Stock splits, cash-adjust events, and special dividends update in one storage-slot write. No reissue, no fork, no downstream migration.",
  },
  {
    Icon: Shield,
    label: "Chainlink Total-Return feeds",
    body:
      "Dividend accrual + PnL are on-chain-native. Regulatory tax reporting can be generated automatically from feed history — impossible on today's brokerage stack.",
  },
  {
    Icon: Globe,
    label: "USDG stablecoin",
    body:
      "Issuance proceeds, dividends, buybacks, and redemptions all denominate in one 1-to-1-USD stable that any Robinhood account can mint/redeem at par.",
  },
];

const STATUS_MAP: Record<
  (typeof PHASES)[number]["status"],
  { label: string; badge: "forest" | "peach" | "dark" | "default"; dot: string }
> = {
  shipped:  { label: "Shipped",  badge: "forest",  dot: "bg-forest-500" },
  next:     { label: "Next up",  badge: "peach",   dot: "bg-peach-500" },
  planned:  { label: "Planned",  badge: "default", dot: "bg-ink-500" },
  vision:   { label: "Vision",   badge: "default", dot: "bg-ink-300" },
};

export default function RoadmapPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Roadmap"
        title={
          <>
            From subscription protocol to the{" "}
            <span className="italic font-display text-peach-500">
              NASDAQ replacement.
            </span>
          </>
        }
        description="RPO is the on-ramp. In four phases we go from letting non-US retail subscribe to Robinhood's Reg-S Stock Tokens, to being the primary market where any company IPOs on-chain from day 1."
      />

      {/* Manifesto strip */}
      <section className="section-tight border-b border-line">
        <div className="container-wide grid lg:grid-cols-[1fr_auto] items-end gap-8">
          <div className="max-w-3xl">
            <div className="eyebrow mb-4">Why now</div>
            <p className="text-xl lg:text-2xl text-ink-900 leading-[1.4] font-display">
              Since 2014 every technical component of an on-chain IPO has
              existed. What has been missing is a single team willing to
              stack {" "}
              <span className="italic">issuance + settlement + secondary market + boost-weighted retail allocation</span>
              {" "}on a chain that finance actually respects. Robinhood Chain
              gave us the last piece. RPO is going to be that stack.
            </p>
          </div>
          <div className="text-right hidden lg:block">
            <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500 font-mono mb-1">
              North-star metric
            </div>
            <div className="font-display text-5xl text-ink-900 tabular-nums">
              $1T
            </div>
            <div className="text-xs text-ink-500 font-mono mt-1">
              of tokenized public equity settled through RPO by 2030
            </div>
          </div>
        </div>
      </section>

      {/* Horizontal timeline */}
      <section className="section-tight">
        <div className="container-wide">
          <div className="grid md:grid-cols-5 gap-2">
            {PHASES.map((p) => {
              const st = STATUS_MAP[p.status];
              return (
                <div
                  key={p.n}
                  className="relative border-t-2 pt-4"
                  style={{
                    borderColor:
                      p.status === "shipped"
                        ? "#0B4D3E"
                        : p.status === "next"
                        ? "#FF6A3D"
                        : "rgba(10,10,10,0.15)",
                  }}
                >
                  <span
                    className={
                      "absolute -top-[7px] left-0 h-3 w-3 rounded-full " + st.dot
                    }
                  />
                  <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
                    Phase {p.n}
                  </div>
                  <div className="text-xs text-ink-500 mt-1 font-mono">
                    {p.year}
                  </div>
                  <div className="text-lg text-ink-900 font-display mt-2">
                    {p.codename}
                  </div>
                  <div className="text-xs text-ink-500 mt-3 leading-relaxed line-clamp-3">
                    {p.title}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Phase detail cards */}
      <section className="section">
        <div className="container-wide space-y-10">
          {PHASES.map((p) => {
            const st = STATUS_MAP[p.status];
            return (
              <div
                key={p.n}
                className="card p-8 lg:p-10 grid lg:grid-cols-[220px_1fr] gap-8"
              >
                <div className="lg:border-r lg:border-line lg:pr-8">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-ink-500 font-mono">
                    Phase {p.n} · {p.year}
                  </div>
                  <div className="font-display text-3xl text-ink-900 mt-2">
                    {p.codename}
                  </div>
                  <div className="mt-4">
                    <Badge variant={st.badge} dot={p.status === "next"}>
                      {st.label}
                    </Badge>
                  </div>
                  <div className="mt-6 text-xs text-ink-500 font-mono">
                    Target: {p.delivered}
                  </div>
                </div>

                <div className="min-w-0">
                  <h3 className="font-display text-2xl lg:text-3xl text-ink-900 mb-4">
                    {p.title}
                  </h3>
                  <p className="text-ink-500 leading-relaxed mb-6">{p.body}</p>

                  <div className="grid sm:grid-cols-3 gap-4 mt-6">
                    <MiniField label="Who can participate" value={p.who} />
                    <MiniField label="Legal path" value={p.legal} />
                    <MiniField
                      label={
                        p.status === "shipped"
                          ? "Modules deployed"
                          : "New modules"
                      }
                      value={p.modules.join(" · ")}
                      mono
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Legal path matrix */}
      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide">
          <div className="eyebrow mb-4">Legal paths</div>
          <h2 className="font-display text-3xl lg:text-4xl text-ink-900 mb-4 max-w-3xl">
            Four regulatory routes to a real on-chain IPO.
          </h2>
          <p className="text-ink-500 max-w-2xl mb-8">
            All four are legally live today — used by real companies, with
            real filings on file. What&apos;s new is stacking them on chain
            infrastructure that finance can settle real trades on.
          </p>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-white text-xs uppercase tracking-[0.14em] text-ink-500">
                    <th className="text-left p-4 font-normal">Framework</th>
                    <th className="text-left p-4 font-normal">Cap</th>
                    <th className="text-left p-4 font-normal">Who buys</th>
                    <th className="text-left p-4 font-normal">Time</th>
                    <th className="text-left p-4 font-normal">Legal cost</th>
                    <th className="text-left p-4 font-normal">Lock-up</th>
                    <th className="text-left p-4 font-normal">US retail</th>
                    <th className="text-left p-4 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {LEGAL_PATHS.map((r) => (
                    <tr
                      key={r.name}
                      className="border-b border-line last:border-0 hover:bg-white transition-colors"
                    >
                      <td className="p-4 text-ink-900 font-semibold">{r.name}</td>
                      <td className="p-4 text-ink-500 tabular-nums font-mono">{r.cap}</td>
                      <td className="p-4 text-ink-500">{r.who}</td>
                      <td className="p-4 text-ink-500 font-mono">{r.time}</td>
                      <td className="p-4 text-ink-500 font-mono tabular-nums">{r.cost}</td>
                      <td className="p-4 text-ink-500">{r.lock}</td>
                      <td className="p-4">
                        {r.retail ? (
                          <Check className="h-4 w-4 text-forest-500" />
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-xs text-ink-500 font-mono">
                          {r.live}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 text-xs text-ink-500">
            Not legal advice. Actual offering structures require jurisdiction-
            specific counsel. RPO Labs partners with Cooley, Wilson Sonsini,
            and Latham on offering documents.
          </div>
        </div>
      </section>

      {/* Precedent */}
      <section className="section">
        <div className="container-wide">
          <div className="eyebrow mb-4">Precedent</div>
          <h2 className="font-display text-3xl lg:text-4xl text-ink-900 mb-4 max-w-3xl">
            This is not theoretical.
          </h2>
          <p className="text-ink-500 max-w-2xl mb-10">
            Five companies have already IPO&apos;d directly on chain. What has
            been missing is a chain that traders and issuers can settle
            institutional volume on — which is exactly what Robinhood Chain
            delivers.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PRECEDENT.map((p) => (
              <div key={p.company} className="card p-6">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="font-semibold text-ink-900 text-lg">
                    {p.company}
                  </div>
                  <div className="text-xs text-ink-500 font-mono">{p.year}</div>
                </div>
                <div className="text-sm text-ink-500 leading-relaxed">
                  {p.what}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why RH Chain */}
      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide">
          <div className="eyebrow mb-4">Why Robinhood Chain</div>
          <h2 className="font-display text-3xl lg:text-4xl text-ink-900 mb-4 max-w-3xl">
            The first L2 that finance can settle real securities on.
          </h2>
          <p className="text-ink-500 max-w-2xl mb-10">
            Every other chain treats tokenized equities as a use case. Robinhood
            Chain treats it as the reason the chain exists — and that shows in
            the primitives.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {CHAIN_ADVANTAGE.map((c) => (
              <div key={c.label} className="card p-6">
                <c.Icon className="h-5 w-5 text-forest-500 mb-3" />
                <div className="font-semibold text-ink-900">{c.label}</div>
                <div className="text-sm text-ink-500 mt-2 leading-relaxed">
                  {c.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What we're adding */}
      <section className="section">
        <div className="container-wide max-w-4xl">
          <Prose>
            <H2 id="modules">What we&apos;re adding to the protocol</H2>
            <p>
              Today&apos;s RPO deploys 5 contracts. Phases 01 → 04 add three
              new modules that turn RPO from a subscription protocol into a
              full primary-issuance stack.
            </p>
            <H3 id="issuance">IssuanceFactory</H3>
            <p>
              CREATE2 factory that deploys ERC-8056 share tokens on behalf of
              a SPV. Ticker becomes the salt. Total supply is bounded by the
              cap-table constant. Deployment is trust-minimized: the same
              audit + non-upgrade posture as SubscriptionVault.
            </p>
            <CodeBlock
              lang="solidity"
              filename="src/IssuanceFactory.sol (planned)"
              code={`function issue(
    IssuanceParams calldata p,
    address transferPolicy
) external onlyQualifiedSPV returns (address share, address vault) {
    share = address(new EquityToken{salt: p.ticker}(p, transferPolicy));
    vault = registry.propose(
        p.ticker,
        p.expectedPrice,
        p.target,
        p.subDeadline,
        p.fulfillDeadline
    );
    emit Issued(p.ticker, share, vault, msg.sender);
}`}
            />

            <H3 id="policy">TransferPolicy (ERC-3643)</H3>
            <p>
              Every share token holds a reference to a TransferPolicy contract
              that either permits or reverts each transfer. Different policies
              encode different offering rules:
            </p>
            <ul>
              <li>
                <code>RegSPolicy</code> — rejects transfers to any address
                on the OFAC + US-persons blacklist maintained by a trusted
                oracle.
              </li>
              <li>
                <code>RegDPolicy</code> — requires both parties to hold an
                <code>AccreditationSBT</code> from an approved KYC provider.
                Enforces 12-month Rule 144 lockups per acquisition.
              </li>
              <li>
                <code>RegAPolicy</code> — no restrictions after SEC
                qualification.
              </li>
              <li>
                <code>S1Policy</code> — trades only permitted through the
                approved FINRA-registered ATS.
              </li>
            </ul>

            <H3 id="captable">CapTable</H3>
            <p>
              Every share token doubles as its own on-chain cap table. Balance
              of an address is that address&apos;s shareholder position; the
              contract acts as SEC-registered Transfer Agent of record (via a
              Vertalo partnership until we obtain the TA license ourselves).
              Dividends, splits, and stock-issuance events all execute
              atomically through <code>uiMultiplier()</code> updates.
            </p>
          </Prose>
        </div>
      </section>

      {/* Bottleneck honesty */}
      <section className="section-tight border-t border-line">
        <div className="container-wide max-w-4xl">
          <Prose>
            <H2 id="honesty">The bottleneck is not the chain</H2>
            <p>
              We are engineers, so let us be blunt about what will and
              won&apos;t stop this roadmap.
            </p>
            <p>
              <strong>Chain-side: solved.</strong> Every technical piece —
              CREATE2 issuance, ERC-8056 corporate actions, sub-second
              settlement, propAMM secondary markets, on-chain KYC gating — is
              live today.
            </p>
            <p>
              <strong>Legal-side: partly solved.</strong> Reg-S and Reg-D
              paths need only a Cayman SPV and a competent securities lawyer.
              Reg-A+ Tier 2 needs SEC qualification. Full S-1 needs a FINRA-
              registered ATS partnership.
            </p>
            <p>
              <strong>Distribution-side: the real work.</strong> The problem
              worth solving over the next 24 months is not writing the
              contracts — it is convincing 20 great companies that IPO&apos;ing
              on RPO is a better default than paying Goldman $50M. That takes
              proof (Phase 01 issuances), a boost-flywheel of committed
              stakers, and a legal template so simple that a founder can read
              it over a weekend.
            </p>
          </Prose>
        </div>
      </section>

      {/* CTA */}
      <section className="section border-t border-line">
        <div className="container-wide">
          <div className="card-dark p-10 lg:p-14 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <Badge variant="peach">Talk to us</Badge>
              <h2 className="font-display text-3xl lg:text-4xl mt-4 mb-3">
                If you&apos;re a founder, a lawyer, or an ATS operator — we&apos;re hiring the future.
              </h2>
              <p className="text-white/70 max-w-lg">
                We are actively selecting the first cohort of companies to
                launch through Phase 01 in Q3 2026. Space is capped at 10 to
                keep the operational lift sustainable.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 md:justify-end">
              <a
                href="mailto:issue@rpo.xyz?subject=Phase 01 IPO application"
                className="btn-primary bg-peach-500 hover:bg-peach-600 text-white text-sm"
              >
                Apply to IPO
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <a
                href="/whitepaper"
                className="btn text-sm border border-white/20 hover:border-white text-white rounded-full px-5 py-2.5 inline-flex items-center gap-2"
              >
                Read the whitepaper
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function MiniField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-mono mb-2">
        {label}
      </div>
      <div
        className={
          "text-sm text-ink-900 " + (mono ? "font-mono text-xs" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}
