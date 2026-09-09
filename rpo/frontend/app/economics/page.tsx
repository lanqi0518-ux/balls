import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Prose } from "@/components/ui/Prose";
import { H2, H3 } from "@/components/ui/H";
import { Badge } from "@/components/ui/Badge";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Check } from "@/components/ui/Icons";

export const metadata = {
  title: "Economics",
  description:
    "How RPO's deal-flow model, subscription mechanics, and $RPO staking flywheel guarantee the protocol keeps running — with objective success metrics and honest failure modes.",
};

const SOURCES = [
  {
    n: "01",
    name: "RHJ Reg-S Stock Token listings",
    monthly: "5 – 20 / month",
    control: "Low",
    controlColor: "bg-peach-100 text-peach-600",
    depends: "Robinhood's listing cadence",
    live: true,
    body:
      "Robinhood Assets (Jersey) has been tokenizing US equities as ERC-8056 Reg-S securities since 2024. The RPO keeper polls the public /rhj/assets endpoint every 60s and auto-fires IPORegistry.propose() the moment a new ticker appears.",
  },
  {
    n: "02",
    name: "Aftermarket Vaults (always-on)",
    monthly: "~500 live · always",
    control: "High",
    controlColor: "bg-forest-50 text-forest-500",
    depends: "RPO Labs + AssetDiscovery.sol",
    live: true,
    body:
      "One always-on vault per Robinhood-listed stock token (~200 today, growing). Users deposit USDG at any time; keeper batch-fulfills every 4h via Rialto propAMM at oracle-bound pricing. AAPL, TSLA, NVDA, SPY — real equities, subscribable at any moment. Deployed permissionlessly via AssetDiscovery.openAftermarket(token).",
  },
  {
    n: "03",
    name: "Pons Launchpad graduations",
    monthly: "20 – 100 / day",
    control: "Medium",
    controlColor: "bg-peach-100 text-peach-600",
    depends: "Pons factory event stream",
    live: true,
    body:
      "Every token that completes its bonding curve on Pons Launchpad graduates to Uniswap V4 and, in the same block, gets a 72-hour RPO subscription vault via AssetDiscovery.openPonsGraduation(token). Fair-launch community tokens with real cap tables, at web-scale volume: dozens of new vaults per day, fully automated.",
  },
  {
    n: "04",
    name: "Direct Reg-S issuance (Phase 01)",
    monthly: "2 – 4 / month",
    control: "High",
    controlColor: "bg-forest-50 text-forest-500",
    depends: "SPV template + curation",
    live: "Q3 2026",
    body:
      "Companies incorporate a Cayman/Jersey SPV, file a Reg-S offering circular, and issue ERC-8056 shares directly through RPO's IssuanceFactory. Curated by RPO Labs; expected to skew crypto-native + global-non-US SaaS.",
  },
  {
    n: "05",
    name: "Reg-D 506(c) / Reg-A+",
    monthly: "5 – 10 / month",
    control: "Medium",
    controlColor: "bg-peach-100 text-peach-600",
    depends: "SEC qualification (Reg-A+)",
    live: "Q4 2026 – Q2 2027",
    body:
      "Once accreditation-SBT and Reg-A+ prospectus templates are live, RPO enters the US-retail issuance market. Reg-A+ is the first path where a founder can IPO in the ordinary sense without paying Goldman Sachs $50M.",
  },
  {
    n: "06",
    name: "Grants-funded launches",
    monthly: "1 – 3 / month",
    control: "High",
    controlColor: "bg-forest-50 text-forest-500",
    depends: "Treasury allocation",
    live: true,
    body:
      "$5M/year budget from treasury to underwrite legal + tech costs for select first-time issuers. Guarantees a floor of deal flow independent of external conditions. See /grants for terms.",
  },
];

const RISKS = [
  {
    risk: "RHJ stops listing new tokens",
    impact: "Kills Phase 00 organic deal flow",
    mitigation:
      "Aftermarket Vaults keep the calendar populated with existing hot equities. Phase 01+ (RPO as issuer) removes dependency entirely.",
  },
  {
    risk: "IPOs don't pop → subscription demand dies",
    impact: "Boost premium collapses, RPO flywheel reverses",
    mitigation:
      "Chainlink oracle bound in vaults: if propAMM price > 2% above spot at fulfillment, subscribers are auto-refunded. Curation team selects only assets with active order flow.",
  },
  {
    risk: "$RPO price crashes",
    impact: "Users stop staking, boost distribution flattens",
    mitigation:
      "Boost formula uses stake-share in the pool, not USD value. Staker earns the SAME boost regardless of $RPO price, as long as their share of the pool holds.",
  },
  {
    risk: "SEC action against Reg-S wrappers",
    impact: "Kills Phase 00, chills Phase 01",
    mitigation:
      "RHJ tokens explicitly reject US persons via the transfer-policy contract. RPO frontend geo-blocks US/CA/UK/CH/AE IPs. Legal counsel: Cooley (SF) + Ogier (Cayman).",
  },
  {
    risk: "Rialto propAMM quotes bad prices",
    impact: "Users get worse fills than open-market swap",
    mitigation:
      "RialtoAdapter enforces Chainlink slippage cap (default 200bps). If quote > cap, adapter falls back to Uniswap V3, then 0x RFQ. If all three exceed, vault refunds automatically.",
  },
  {
    risk: "Pons launchpad captures issuers first",
    impact: "Deal flow leaks to competitor",
    mitigation:
      "Pons targets meme tokens with bonding curves. RPO targets equities with real cash flows and Chainlink oracles. Distinct users, distinct issuers. RPO can settle a $100M Reg-A+ raise; Pons cannot.",
  },
  {
    risk: "Cold-start: early vaults get no subscribers",
    impact: "Vault fails to hit target, gets refunded, momentum dies",
    mitigation:
      "Treasury seeds first 20 vaults with $500k each. Boost curve rewards early stakers with disproportionate weight (√share not linear) — first movers get 40-60% of allocation on the first cohort of IPOs.",
  },
];

const CONDITIONS = [
  {
    n: 1,
    text: "At least 1 active subscription window visible every day of the week",
    solved: true,
    how: "RHJ keeper + Aftermarket Vaults keep the calendar populated",
  },
  {
    n: 2,
    text: "At least 30% of subscriptions become oversubscribed (creates boost premium)",
    solved: null,
    how: "Curation + community growth · target Q3 2026",
  },
  {
    n: 3,
    text: "Boost impact is legible to every user before subscribing",
    solved: true,
    how: "Side-by-side USD comparison shown on subscribe screen",
  },
  {
    n: 4,
    text: "Aftermarket price of subscribed tokens outperforms USDG hold",
    solved: null,
    how: "Chainlink-tracked realized returns published on /explorer weekly",
  },
];

export default function EconomicsPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Economics"
        title={
          <>
            Why this{" "}
            <span className="italic font-display text-peach-500">actually</span>
            {" "}works.
          </>
        }
        description="A deliberate, checkable model for how RPO stays alive: five independent deal-flow sources (three of which we control), a subscription mechanic that separates payment from priority, and a $RPO flywheel that pays holders in scarce IPO allocation instead of inflation."
      />

      {/* -------------------------------------------------------------- */}
      {/* 1. Deal flow                                                   */}
      {/* -------------------------------------------------------------- */}
      <section className="section">
        <div className="container-wide">
          <div className="eyebrow mb-4">01 · Deal Flow</div>
          <h2 className="font-display text-3xl lg:text-5xl text-ink-900 mb-6 max-w-3xl">
            Six independent sources. Three fully automated. Zero human bottleneck.
          </h2>
          <p className="text-ink-500 max-w-2xl mb-12 leading-relaxed text-lg">
            The single largest failure mode for any launchpad is running out of
            things to launch. RPO&apos;s design refuses to depend on any single
            upstream. Even in a nuclear-winter scenario where the RHJ pipeline
            freezes, Aftermarket (~500 always-on) and Pons (20-100 new / day)
            keep the calendar dense enough that a wallet-connected user always
            has something meaningful to subscribe to.
          </p>

          <div className="space-y-3">
            {SOURCES.map((s) => (
              <div key={s.n} className="card p-6 lg:p-8 grid lg:grid-cols-[80px_1fr_240px] gap-6">
                <div className="text-[10px] uppercase tracking-[0.22em] text-ink-500 font-mono">
                  Source {s.n}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl text-ink-900 font-display">
                      {s.name}
                    </h3>
                    {s.live === true ? (
                      <Badge variant="forest" dot>Live</Badge>
                    ) : (
                      <Badge variant="peach">{s.live}</Badge>
                    )}
                  </div>
                  <p className="text-ink-500 text-sm leading-relaxed">
                    {s.body}
                  </p>
                </div>
                <div className="space-y-3 lg:border-l lg:border-line lg:pl-6">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-mono mb-1">
                      Monthly volume
                    </div>
                    <div className="text-2xl font-display text-ink-900 tabular-nums">
                      {s.monthly}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-mono mb-1">
                      Control
                    </div>
                    <div>
                      <span
                        className={
                          "inline-block text-xs px-2 py-0.5 rounded-full font-medium " +
                          s.controlColor
                        }
                      >
                        {s.control}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-3xl bg-forest-50 border border-forest-200 p-8">
            <div className="flex items-start gap-4">
              <div className="text-forest-500 mt-1">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-forest-700 mb-2 text-lg">
                  Composite target (steady-state): 200 – 500 live vaults on any given day
                </div>
                <p className="text-forest-700 text-sm leading-relaxed">
                  Aftermarket alone gives ~500 always-on vaults (one per
                  RHJ-listed token, rotated every 4h). Pons layers 20-100 new
                  72h subscription windows on top per day. RHJ Reg-S adds 5-20
                  headline IPOs per month. Anything else (Direct Reg-S,
                  Reg-A+, Grants) is a bonus. Connect a wallet, no KYC, no
                  gate — subscribe.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* 2. Subscription mechanics                                       */}
      {/* -------------------------------------------------------------- */}
      <section className="section border-t border-line bg-paper-100">
        <div className="container-wide">
          <div className="eyebrow mb-4">02 · Subscription Mechanics</div>
          <h2 className="font-display text-3xl lg:text-5xl text-ink-900 mb-6 max-w-3xl">
            USDG buys shares.{" "}
            <span className="italic text-peach-500">$RPO</span> buys priority.
          </h2>
          <p className="text-ink-500 max-w-2xl mb-12 leading-relaxed text-lg">
            The single most-asked question: do users stake $RPO to IPO? Close
            but not exactly. Payment and priority are separated by design —
            anyone can participate with just USDG, but $RPO stakers earn a
            weight multiplier that matters when the IPO is oversubscribed.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-10">
            <div className="card p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-ink-900 text-white flex items-center justify-center font-semibold text-sm">
                  1
                </div>
                <h3 className="font-display text-2xl text-ink-900">USDG</h3>
                <Badge>required</Badge>
              </div>
              <div className="text-forest-500 font-mono text-xs mb-4">
                the payment layer
              </div>
              <p className="text-ink-500 leading-relaxed">
                Users deposit USDG (Robinhood&apos;s 1-to-1 stablecoin) into
                the SubscriptionVault during the subscription window. This is
                the actual capital that will buy the underlying Stock Token
                when the vault fulfills. No RPO needed. No KYC. Fully
                refundable if the IPO doesn&apos;t list on time.
              </p>
            </div>

            <div className="card p-8 border-forest-500 border-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-forest-500 text-white flex items-center justify-center font-semibold text-sm">
                  2
                </div>
                <h3 className="font-display text-2xl text-ink-900">$RPO</h3>
                <Badge variant="forest">optional but valuable</Badge>
              </div>
              <div className="text-forest-500 font-mono text-xs mb-4">
                the priority layer
              </div>
              <p className="text-ink-500 leading-relaxed">
                Stakers of $RPO receive a boost multiplier (1.00× to 3.00×)
                that scales their subscription weight — but not their
                subscription payment. If the vault is oversubscribed, stakers
                get a disproportionately larger share of the fixed pool of
                shares.
              </p>
            </div>
          </div>

          <div className="card p-8 lg:p-10">
            <h3 className="font-display text-2xl text-ink-900 mb-6">
              Same $1,000 USDG. Different boost. Different fill.
            </h3>
            <p className="text-ink-500 mb-8 max-w-3xl">
              Example: dSTRIPE, oversubscribed 3× ($15M subscribed / $5M
              target). Vault will fulfill only $5M worth of shares, distributed
              pro-rata by weight.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-[0.14em] text-ink-500">
                    <th className="text-left py-3 pr-6 font-normal">Your $RPO position</th>
                    <th className="text-left py-3 px-6 font-normal">Boost</th>
                    <th className="text-left py-3 px-6 font-normal">Weight from $1,000</th>
                    <th className="text-left py-3 px-6 font-normal">dSTRIPE received</th>
                    <th className="text-left py-3 pl-6 font-normal">vs. no stake</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {[
                    { pos: "Not staked", boost: 1.0, weight: 1000, tokens: 3.91, delta: null },
                    { pos: "0.1% of pool", boost: 1.06, weight: 1060, tokens: 4.14, delta: 5.9 },
                    { pos: "1% of pool", boost: 1.20, weight: 1200, tokens: 4.69, delta: 20.0 },
                    { pos: "10% of pool", boost: 1.63, weight: 1630, tokens: 6.37, delta: 63.0 },
                    { pos: "25% of pool", boost: 2.00, weight: 2000, tokens: 7.82, delta: 100.0 },
                    { pos: "100% of pool", boost: 3.00, weight: 3000, tokens: 11.73, delta: 200.0 },
                  ].map((r) => (
                    <tr
                      key={r.pos}
                      className="border-b border-line last:border-0"
                    >
                      <td className="py-3 pr-6 text-ink-900 font-sans">{r.pos}</td>
                      <td className="py-3 px-6 text-ink-900">{r.boost.toFixed(2)}×</td>
                      <td className="py-3 px-6 text-ink-500">{r.weight.toLocaleString()}</td>
                      <td className="py-3 px-6 text-ink-900 font-semibold">
                        {r.tokens.toFixed(2)} dSTRIPE
                      </td>
                      <td className="py-3 pl-6">
                        {r.delta === null ? (
                          <span className="text-ink-300">baseline</span>
                        ) : (
                          <span className="text-forest-500 font-semibold">
                            +{r.delta.toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 text-xs text-ink-500">
              Boost formula:{" "}
              <code className="text-forest-500 bg-forest-50 px-1.5 py-0.5 rounded font-mono">
                1 + 2·√(share)
              </code>
              . Capped at 3.00×. Square-root shape guarantees early stakers
              retain meaningful advantage without a mega-whale monopolizing
              allocations.
            </div>
          </div>

          <div className="mt-8">
            <CodeBlock
              lang="solidity"
              filename="AllocationBooster.sol"
              code={`function getBoost(address user) public view returns (uint256) {
    uint256 userStake = stakes[user].amount;
    if (userStake == 0 || totalStaked == 0) return BASE_BOOST; // 1x

    uint256 share = (userStake * 1e18) / totalStaked;
    uint256 sqrtShare = _sqrt(share * 1e18);
    uint256 boost = BASE_BOOST + (2 * sqrtShare);

    return boost > MAX_BOOST ? MAX_BOOST : boost;
}`}
            />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* 3. Flywheel                                                      */}
      {/* -------------------------------------------------------------- */}
      <section className="section">
        <div className="container-wide max-w-5xl">
          <div className="eyebrow mb-4">03 · The Flywheel</div>
          <h2 className="font-display text-3xl lg:text-5xl text-ink-900 mb-6">
            More IPOs → more $RPO demand → more IPOs.
          </h2>
          <p className="text-ink-500 max-w-2xl mb-12 leading-relaxed text-lg">
            The economic loop is deliberately narrow. Every unit of the flywheel
            reinforces the next. No inflation-based rewards, no unsustainable
            emissions.
          </p>

          <div className="card p-8 lg:p-12">
            <div className="grid gap-4 text-center">
              {[
                { step: "01", text: "More IPOs list on RPO", color: "bg-forest-50 text-forest-700" },
                { step: "02", text: "Oversubscription becomes common", color: "bg-forest-50 text-forest-700" },
                { step: "03", text: "Boost multiplier becomes economically valuable", color: "bg-forest-50 text-forest-700" },
                { step: "04", text: "Demand to hold + stake $RPO rises", color: "bg-peach-50 text-peach-600" },
                { step: "05", text: "Staked supply increases → circulating supply drops", color: "bg-peach-50 text-peach-600" },
                { step: "06", text: "2% platform fees (in USDG) buy back + burn $RPO", color: "bg-peach-50 text-peach-600" },
                { step: "07", text: "Scarcer $RPO → each unit of boost more expensive", color: "bg-ink-900 text-white" },
                { step: "08", text: "Founders see traction + fair pricing → more IPOs choose RPO", color: "bg-ink-900 text-white" },
              ].map((s) => (
                <div key={s.step} className="relative">
                  <div className={"rounded-2xl p-4 " + s.color}>
                    <div className="text-[10px] uppercase tracking-[0.22em] font-mono opacity-70 mb-1">
                      {s.step}
                    </div>
                    <div className="font-semibold">{s.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 grid md:grid-cols-3 gap-4">
            <div className="card p-6">
              <div className="text-[10px] uppercase tracking-[0.22em] text-ink-500 font-mono mb-2">
                Year-1 revenue target
              </div>
              <div className="font-display text-3xl text-ink-900">$600k</div>
              <div className="text-sm text-ink-500 mt-2">
                100 vaults × $300k avg × 2% fee
              </div>
            </div>
            <div className="card p-6">
              <div className="text-[10px] uppercase tracking-[0.22em] text-ink-500 font-mono mb-2">
                Buyback ratio
              </div>
              <div className="font-display text-3xl text-ink-900">100%</div>
              <div className="text-sm text-ink-500 mt-2">
                Every USDG fee → open-market $RPO buy → burn or vault accrual
              </div>
            </div>
            <div className="card p-6">
              <div className="text-[10px] uppercase tracking-[0.22em] text-ink-500 font-mono mb-2">
                Team / VC allocation
              </div>
              <div className="font-display text-3xl text-ink-900">0%</div>
              <div className="text-sm text-ink-500 mt-2">
                Fair launch on Pons, 1B fixed supply, no unlock cliff
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* 4. Risks                                                        */}
      {/* -------------------------------------------------------------- */}
      <section className="section border-t border-line bg-paper-100">
        <div className="container-wide">
          <div className="eyebrow mb-4">04 · Failure Modes</div>
          <h2 className="font-display text-3xl lg:text-5xl text-ink-900 mb-6 max-w-3xl">
            Seven ways this could die. Seven mitigations we&apos;ve pre-built.
          </h2>
          <p className="text-ink-500 max-w-2xl mb-12 leading-relaxed text-lg">
            No hand-waving. These are the specific failure modes we&apos;ve
            considered and the specific mitigations we&apos;ve either shipped
            or planned. If you can name an eighth, tell us at{" "}
            <a href="mailto:security@rpo.xyz" className="text-forest-500 hover:underline">
              security@rpo.xyz
            </a>
            .
          </p>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-white text-xs uppercase tracking-[0.14em] text-ink-500">
                    <th className="text-left p-5 font-normal w-56">Risk</th>
                    <th className="text-left p-5 font-normal w-48">Impact</th>
                    <th className="text-left p-5 font-normal">Mitigation</th>
                  </tr>
                </thead>
                <tbody>
                  {RISKS.map((r) => (
                    <tr
                      key={r.risk}
                      className="border-b border-line last:border-0 hover:bg-white transition-colors"
                    >
                      <td className="p-5 text-ink-900 font-semibold align-top">
                        {r.risk}
                      </td>
                      <td className="p-5 text-ink-500 align-top">{r.impact}</td>
                      <td className="p-5 text-ink-500 align-top leading-relaxed">
                        {r.mitigation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* 5. Success conditions                                           */}
      {/* -------------------------------------------------------------- */}
      <section className="section">
        <div className="container-wide max-w-4xl">
          <div className="eyebrow mb-4">05 · Success Conditions</div>
          <h2 className="font-display text-3xl lg:text-5xl text-ink-900 mb-6">
            Four checkable conditions. Auditable in public.
          </h2>
          <p className="text-ink-500 mb-12 leading-relaxed text-lg">
            Rather than promising vague success, we commit to four objective
            conditions and publish real-time progress against them on{" "}
            <a href="/status" className="text-forest-500 hover:underline">
              /status
            </a>
            . If we miss any of these, we say so.
          </p>

          <div className="space-y-4">
            {CONDITIONS.map((c) => (
              <div key={c.n} className="card p-6 flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {c.solved === true ? (
                    <div className="h-8 w-8 rounded-full bg-forest-500 text-white flex items-center justify-center">
                      <Check className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-paper-200 border border-line text-ink-500 flex items-center justify-center font-mono text-xs">
                      {c.n}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-ink-900 font-semibold mb-1">
                    {c.text}
                  </div>
                  <div className="text-sm text-ink-500">{c.how}</div>
                </div>
                <div className="flex-shrink-0">
                  {c.solved === true ? (
                    <Badge variant="forest">Shipped</Badge>
                  ) : (
                    <Badge>Tracking</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* 6. Sober close                                                  */}
      {/* -------------------------------------------------------------- */}
      <section className="section-tight border-t border-line">
        <div className="container-wide max-w-4xl">
          <Prose>
            <H2 id="honest">A sober close</H2>
            <p>
              None of this guarantees RPO succeeds. Success requires the RPO
              team to keep curating good IPOs, keep negotiating good primary
              allocations, keep operations tight, and keep the community
              informed. What the design does guarantee is that no single
              external failure — Robinhood pausing tokenization, a bear market
              for IPOs, a bad regulator, a competitor launchpad — can kill the
              protocol overnight. There is always a next vault to open.
            </p>
            <H3 id="test-yourself">Test any claim yourself</H3>
            <ul>
              <li>Deal-flow claim → read the keeper source at <code>rpo/keeper/</code></li>
              <li>Boost formula → verify against <code>AllocationBooster.sol#getBoost</code></li>
              <li>Fee flow → follow USDG from a real subscribe tx on{" "}
                <a href="/explorer">/explorer</a></li>
              <li>Fair launch → check the Pons pair address on{" "}
                <a href="/ecosystem">/ecosystem</a></li>
            </ul>
            <p>
              The protocol is designed so that nothing on this page has to be
              taken on faith.
            </p>
          </Prose>
        </div>
      </section>
    </MarketingShell>
  );
}
