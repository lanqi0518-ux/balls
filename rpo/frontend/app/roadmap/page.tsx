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
    "From IPO subscription to on-chain IPO issuance. RPO's four-phase plan to build a NASDAQ alternative for on-chain public equity.",
};

const PHASES = [
  {
    n: "00",
    year: "Pre-launch",
    codename: "Subscribe",
    status: "next" as const,
    title: "Permissionless subscription to RHJ Stock Tokens",
    body:
      "The core RPO protocol: users subscribe to Robinhood Assets Jersey Reg-S Stock Tokens the moment they are listed. Priced via Rialto propAMM, allocated by $RPO-weighted staker boost, refunded permissionlessly if the underlying doesn't list. Contracts are written; awaiting audits and mainnet deployment.",
    who: "Any non-US wallet (once live)",
    legal: "None required — reads existing Reg-S offerings",
    modules: ["IPORegistry", "SubscriptionVault", "AssetDiscovery", "AllocationBooster", "RialtoAdapter", "LeverageLooper"],
  },
  {
    n: "00b",
    year: "After Phase 00",
    codename: "Scale",
    status: "planned" as const,
    title: "AssetDiscovery — always-on aftermarket vaults",
    body:
      "Deploy AssetDiscovery.sol: a permissionless factory anyone can call to spawn subscription vaults for (a) every RHJ-listed stock token as an always-on aftermarket vault (rolled every 4h), and (b) every Pons Launchpad token that graduates to Uniswap V4 as a 72h subscription window. Same subscribe flow, hundreds of live vaults simultaneously.",
    who: "Any non-US wallet",
    legal: "None required — same Reg-S posture as Phase 00",
    modules: ["AssetDiscovery", "PonsGraduationHandler", "RhjStockTokenSet", "ChainlinkRegistry"],
  },
  {
    n: "01",
    year: "Phase 01",
    codename: "Issue · Reg-S",
    status: "planned" as const,
    title: "Global-non-US IPOs, issued directly through RPO",
    body:
      "RPO becomes a primary issuance venue. Companies incorporate a Cayman / Jersey SPV, file a Reg-S offering circular, and mint ERC-8056 shares directly on Robinhood Chain — where the tokens ARE the shares, no wrapper. All non-US retail can subscribe on day 1.",
    who: "Any non-US wallet",
    legal: "Regulation S (SEC) — no US persons",
    modules: ["IssuanceFactory", "TransferPolicy (ERC-3643)", "CapTable", "Cayman/Jersey SPV template"],
  },
  {
    n: "02",
    year: "Phase 02",
    codename: "Issue · Reg-D",
    status: "planned" as const,
    title: "Institutional issuances under Reg-D 506(c)",
    body:
      "For companies wanting unlimited raise size and US accredited-investor access, RPO adds a Reg-D 506(c) issuance path with on-chain accreditation gating via a Sumsub/Persona SBT. 12-month Rule 144 lock enforced by the transfer-policy contract.",
    who: "Accredited investors globally, KYC required",
    legal: "Regulation D Rule 506(c) — accredited only",
    modules: ["AccreditationSBT", "Rule144Lockup", "Securitize/Vertalo integration"],
  },
  {
    n: "03",
    year: "Phase 03",
    codename: "Issue · Reg-A+",
    status: "vision" as const,
    title: "US retail IPOs on-chain",
    body:
      "SEC-qualified Reg-A+ Tier-2 offerings, up to $75M per year per issuer. Any US retail wallet can subscribe. This is the first path where a startup 'IPOs' in the ordinary-language sense — no broker, no NASDAQ. RPO acts as the qualification counsel + underwriter of record.",
    who: "US retail + global",
    legal: "Regulation A Tier 2 — SEC qualification required",
    modules: ["Reg-A+ prospectus DAO template", "Transfer Agent partnership", "State blue-sky auto-file"],
  },
  {
    n: "04",
    year: "Phase 04",
    codename: "Compete",
    status: "vision" as const,
    title: "Direct NASDAQ alternative — S-1 tokenized IPOs",
    body:
      "The end state. A full S-1 registered public offering where the shares are ERC-8056 tokens on Robinhood Chain from block 0. Trading venue is a FINRA-registered ATS operated by or in partnership with RPO. Settlement is atomic on-chain rather than T+2 through DTCC.",
    who: "Every public-market participant",
    legal: "Full S-1 registration + FINRA ATS + SEC-registered Transfer Agent",
    modules: ["ATS orderbook", "In-house or partnered Transfer Agent", "DTCC-alternative settlement"],
  },
];

const LEGAL_PATHS = [
  {
    name: "Regulation S",
    cap: "Unlimited",
    who: "Non-US persons only",
    cost: "Moderate legal cost",
    lock: "40-day distribution compliance",
    us: false,
    retail: true,
    live: "In production today at RHJ",
  },
  {
    name: "Regulation D 506(c)",
    cap: "Unlimited",
    who: "Accredited investors globally",
    cost: "Moderate legal cost",
    lock: "12 months (Rule 144)",
    us: true,
    retail: false,
    live: "In production at Securitize, INX",
  },
  {
    name: "Regulation A+ Tier 2",
    cap: "$75M / year",
    cost: "High legal cost",
    who: "US retail + global",
    lock: "None post-qualification",
    us: true,
    retail: true,
    live: "In production; Exodus is a public example",
  },
  {
    name: "S-1 public IPO (tokenized)",
    cap: "Unlimited",
    who: "Everyone (via FINRA ATS)",
    cost: "Standard S-1 cost",
    lock: "Optional underwriter lock",
    us: true,
    retail: true,
    live: "Requires ATS partnership",
  },
];

const PRECEDENT = [
  {
    company: "INX Limited",
    year: 2020,
    what: "First SEC-registered on-chain IPO. Raised roughly $85M in a security-token public offering; INX common stock exists as a live token today.",
  },
  {
    company: "Exodus Movement",
    year: 2021,
    what: "Reg-A+ Tier 2 offering of tokenized common shares. Class-A common stock is native on Algorand and OTCQX cross-listed.",
  },
  {
    company: "tZERO",
    year: 2018,
    what: "Overstock-incubated FINRA-registered ATS. First live venue for trading SEC-registered security tokens.",
  },
  {
    company: "Swiss AGs via Aktionariat",
    year: 2020,
    what: "Dozens of Swiss AGs issue their own ERC-20 share class and trade on-chain under the Swiss DLT Act.",
  },
  {
    company: "Backed Finance / BX Swiss",
    year: 2023,
    what: "Tokenized wrappers of major US equities offered to global-non-US retail via any wallet under Swiss law — a direct precedent for the RHJ Stock Token model.",
  },
];

const CHAIN_ADVANTAGE = [
  {
    Icon: Bolt,
    label: "Fast blocks · low gas",
    body:
      "Per-transfer cost is a fraction of a cent — a scale that traditional settlement fees cannot compete with.",
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
      "Dividend accrual and PnL are on-chain-native. Tax reporting can be generated automatically from feed history — hard to reproduce on a legacy brokerage stack.",
  },
  {
    Icon: Globe,
    label: "USDG stablecoin",
    body:
      "Issuance proceeds, dividends, buybacks, and redemptions all denominate in one 1-to-1-USD stable that RHJ accounts can mint/redeem at par.",
  },
];

const STATUS_MAP: Record<
  (typeof PHASES)[number]["status"],
  { label: string; badge: "forest" | "peach" | "dark" | "default"; dot: string }
> = {
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
            From subscription protocol to an{" "}
            <span className="italic font-display text-peach-500">
              on-chain public market.
            </span>
          </>
        }
        description="RPO is the on-ramp. In four phases the goal is to go from letting non-US retail subscribe to Robinhood's Reg-S Stock Tokens, to being the primary market where a company can IPO on-chain from day 1. Nothing is deployed yet — this is the roadmap, not a shipping log."
      />

      <section className="section-tight border-b border-line">
        <div className="container-wide">
          <div className="card p-6 border-l-4 border-peach-500 bg-peach-50/40 mb-8">
            <Badge variant="peach">Pre-launch</Badge>
            <p className="text-sm text-ink-500 mt-3 leading-relaxed">
              No RPO contracts, tokens, or issuances are live today. Every
              phase below is future-tense until on-chain evidence exists.
            </p>
          </div>
          <div className="grid lg:grid-cols-[1fr_auto] items-end gap-8">
            <div className="max-w-3xl">
              <div className="eyebrow mb-4">Why this direction</div>
              <p className="text-xl lg:text-2xl text-ink-900 leading-[1.4] font-display">
                For years every technical component of an on-chain IPO has
                existed. What has been missing is a single team willing to
                stack {" "}
                <span className="italic">issuance + settlement + secondary market + boost-weighted retail allocation</span>
                {" "}on a chain that finance can actually settle securities
                on. Robinhood Chain is designed for exactly that. RPO
                intends to be the stack that runs on top of it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container-wide">
          <div className="grid md:grid-cols-6 gap-2">
            {PHASES.map((p) => {
              const st = STATUS_MAP[p.status];
              return (
                <div
                  key={p.n}
                  className="relative border-t-2 pt-4"
                  style={{
                    borderColor:
                      p.status === "next" ? "#FF6A3D" : "rgba(10,10,10,0.15)",
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
                      label="Planned modules"
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

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide">
          <div className="eyebrow mb-4">Legal paths</div>
          <h2 className="font-display text-3xl lg:text-4xl text-ink-900 mb-4 max-w-3xl">
            Four regulatory routes to a real on-chain IPO.
          </h2>
          <p className="text-ink-500 max-w-2xl mb-8">
            All four are legally live today — used by real companies, with
            real filings on file. The work is stacking them on chain
            infrastructure that can settle real securities.
          </p>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-white text-xs uppercase tracking-[0.14em] text-ink-500">
                    <th className="text-left p-4 font-normal">Framework</th>
                    <th className="text-left p-4 font-normal">Cap</th>
                    <th className="text-left p-4 font-normal">Who buys</th>
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
                      <td className="p-4 text-ink-500 font-mono">{r.cost}</td>
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
            specific counsel.
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-wide">
          <div className="eyebrow mb-4">Precedent</div>
          <h2 className="font-display text-3xl lg:text-4xl text-ink-900 mb-4 max-w-3xl">
            The pattern is not theoretical.
          </h2>
          <p className="text-ink-500 max-w-2xl mb-10">
            Multiple companies have already IPO&apos;d directly on chain.
            What has been missing is a chain that traders and issuers can
            settle institutional volume on — which is what Robinhood Chain
            is designed to deliver.
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

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide">
          <div className="eyebrow mb-4">Why Robinhood Chain</div>
          <h2 className="font-display text-3xl lg:text-4xl text-ink-900 mb-4 max-w-3xl">
            An L2 designed to settle real securities.
          </h2>
          <p className="text-ink-500 max-w-2xl mb-10">
            Most chains treat tokenized equities as one use case among many.
            Robinhood Chain treats it as the reason the chain exists — and
            that shows in the primitives it standardizes.
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

      <section className="section">
        <div className="container-wide max-w-4xl">
          <Prose>
            <H2 id="modules">What we plan to add to the protocol</H2>
            <p>
              The core RPO design targets 5 contracts at launch. Phases 01 →
              04 add new modules that would turn RPO from a subscription
              protocol into a full primary-issuance stack.
            </p>
            <H3 id="issuance">IssuanceFactory (planned)</H3>
            <p>
              CREATE2 factory that deploys ERC-8056 share tokens on behalf
              of a SPV. Ticker becomes the salt. Total supply is bounded by
              the cap-table constant. Deployment is trust-minimized: the
              same audit + non-upgrade posture as SubscriptionVault.
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

            <H3 id="policy">TransferPolicy (ERC-3643) (planned)</H3>
            <p>
              Every share token holds a reference to a TransferPolicy
              contract that either permits or reverts each transfer.
              Different policies encode different offering rules:
            </p>
            <ul>
              <li>
                <code>RegSPolicy</code> — rejects transfers to any address
                on the OFAC + US-persons blacklist maintained by a trusted
                oracle.
              </li>
              <li>
                <code>RegDPolicy</code> — requires both parties to hold an{" "}
                <code>AccreditationSBT</code> from an approved KYC provider.
                Enforces 12-month Rule 144 lockups per acquisition.
              </li>
              <li>
                <code>RegAPolicy</code> — no restrictions after SEC
                qualification.
              </li>
              <li>
                <code>S1Policy</code> — trades only permitted through an
                approved FINRA-registered ATS.
              </li>
            </ul>

            <H3 id="captable">CapTable (planned)</H3>
            <p>
              Every share token would double as its own on-chain cap table.
              Balance of an address is that address&apos;s shareholder
              position; the contract acts as SEC-registered Transfer Agent
              of record (via a Vertalo-style partnership until an in-house
              TA license is available). Dividends, splits, and stock-issuance
              events execute atomically through <code>uiMultiplier()</code>{" "}
              updates.
            </p>
          </Prose>
        </div>
      </section>

      <section className="section-tight border-t border-line">
        <div className="container-wide max-w-4xl">
          <Prose>
            <H2 id="honesty">The bottleneck is not the chain</H2>
            <p>
              To be blunt about what will and won&apos;t block this roadmap:
            </p>
            <p>
              <strong>Chain-side: mostly solved.</strong> Every technical
              piece — CREATE2 issuance, ERC-8056 corporate actions,
              sub-second settlement, propAMM secondary markets, on-chain
              KYC gating — either exists today or is a modest extension of
              existing patterns.
            </p>
            <p>
              <strong>Legal-side: partly solved.</strong> Reg-S and Reg-D
              paths need a jurisdictionally-appropriate SPV and competent
              securities counsel. Reg-A+ Tier 2 needs SEC qualification.
              Full S-1 needs a FINRA-registered ATS partnership.
            </p>
            <p>
              <strong>Distribution-side: the real work.</strong> The problem
              worth solving is not writing the contracts — it is convincing
              great companies that IPO&apos;ing on RPO is a better default
              than the incumbent underwriting path. That takes proof of the
              first successful issuances, a boost-flywheel of committed
              stakers, and a legal template so simple that a founder can
              read it over a weekend.
            </p>
          </Prose>
        </div>
      </section>

      <section className="section border-t border-line">
        <div className="container-wide">
          <div className="card-dark p-10 lg:p-14 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <Badge variant="peach">Get involved</Badge>
              <h2 className="font-display text-3xl lg:text-4xl mt-4 mb-3">
                If you&apos;re a founder, a lawyer, or an ATS operator — talk to us.
              </h2>
              <p className="text-white/70 max-w-lg">
                RPO is pre-launch. The right way to get involved right now
                is to read the whitepaper, review the source, and open an
                issue or discussion on GitHub.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 md:justify-end">
              <a
                href="https://github.com/lanqi0518-ux/balls/discussions"
                target="_blank"
                rel="noreferrer"
                className="btn-primary bg-peach-500 hover:bg-peach-600 text-white text-sm"
              >
                Open a discussion
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
