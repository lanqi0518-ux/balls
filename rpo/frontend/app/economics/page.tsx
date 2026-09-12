import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Prose } from "@/components/ui/Prose";
import { H2, H3 } from "@/components/ui/H";
import { Badge } from "@/components/ui/Badge";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Check } from "@/components/ui/Icons";

export const metadata = {
  title: "Economics",
  description:
    "How RPO's deal-flow model, subscription mechanics, and $RPO staking flywheel are designed. Pre-launch — no live volume or revenue yet.",
};

const SOURCES = [
  {
    n: "01",
    name: "RHJ Reg-S Stock Token listings",
    monthly: "Depends on RHJ cadence",
    control: "Low",
    controlColor: "bg-peach-100 text-peach-600",
    depends: "Robinhood's listing cadence",
    body:
      "Robinhood Assets (Jersey) tokenizes US equities as ERC-8056 Reg-S securities. The RPO keeper is designed to poll the public RHJ assets endpoint and auto-fire IPORegistry.propose() when a new ticker appears. Requires the keeper to be live and the RPO registry to be deployed.",
  },
  {
    n: "02",
    name: "Aftermarket Vaults (always-on)",
    monthly: "One per listed token",
    control: "High",
    controlColor: "bg-forest-50 text-forest-500",
    depends: "AssetDiscovery.sol",
    body:
      "One always-on vault per Robinhood-listed stock token. Users deposit USDG at any time; keeper batch-fulfills every few hours via Rialto propAMM at oracle-bound pricing. Deployed permissionlessly via AssetDiscovery.openAftermarket(token) once contracts are live.",
  },
  {
    n: "03",
    name: "Pons Launchpad graduations",
    monthly: "Following Pons flow",
    control: "Medium",
    controlColor: "bg-peach-100 text-peach-600",
    depends: "Pons factory event stream",
    body:
      "Every token that completes its bonding curve on Pons Launchpad graduates to Uniswap V4 and, in the same block, gets a 72-hour RPO subscription vault via AssetDiscovery.openPonsGraduation(token). Rate depends on Pons volume once the integration is live.",
  },
  {
    n: "04",
    name: "Direct Reg-S issuance (Phase 01)",
    monthly: "Curated cohort",
    control: "High",
    controlColor: "bg-forest-50 text-forest-500",
    depends: "SPV template + curation",
    body:
      "Companies incorporate a Cayman/Jersey SPV, file a Reg-S offering circular, and issue ERC-8056 shares directly through RPO's IssuanceFactory. Curated; roadmap item.",
  },
  {
    n: "05",
    name: "Reg-D 506(c) / Reg-A+",
    monthly: "Later phases",
    control: "Medium",
    controlColor: "bg-peach-100 text-peach-600",
    depends: "SEC qualification (Reg-A+)",
    body:
      "Once accreditation-SBT and Reg-A+ prospectus templates are live, RPO enters the US-retail issuance market. Reg-A+ is the first path where a founder can IPO in the ordinary sense without a traditional underwriting deal.",
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
      "Chainlink oracle bound in vaults: if propAMM price > 2% above spot at fulfillment, subscribers are auto-refunded. Curation is intended to focus on assets with active order flow.",
  },
  {
    risk: "$RPO price crashes",
    impact: "Users stop staking, boost distribution flattens",
    mitigation:
      "Boost formula uses stake-share in the pool, not USD value. A staker earns the same boost regardless of $RPO price, as long as their share of the pool holds.",
  },
  {
    risk: "SEC action against Reg-S wrappers",
    impact: "Kills Phase 00, chills Phase 01",
    mitigation:
      "RHJ tokens explicitly reject US persons via the transfer-policy contract. RPO frontend geo-blocks US and other restricted IPs. Formal legal review is a hard prerequisite to mainnet.",
  },
  {
    risk: "Rialto propAMM quotes bad prices",
    impact: "Users get worse fills than open-market swap",
    mitigation:
      "RialtoAdapter enforces a Chainlink slippage cap. If quote > cap, adapter falls back to a secondary venue. If all venues exceed, vault refunds automatically.",
  },
  {
    risk: "Pons launchpad captures issuers first",
    impact: "Deal flow leaks to competitor",
    mitigation:
      "Pons targets meme tokens with bonding curves. RPO targets equities with real cash flows and Chainlink oracles. Distinct users, distinct issuers.",
  },
  {
    risk: "Cold-start: early vaults get no subscribers",
    impact: "Vault fails to hit target, gets refunded, momentum dies",
    mitigation:
      "Boost curve rewards early stakers with disproportionate weight (√share not linear) — first movers get a disproportionate share of allocation on the earliest cohort of IPOs.",
  },
];

const CONDITIONS = [
  {
    n: 1,
    text: "At least one active subscription window visible every day of the week",
    how: "RHJ keeper + Aftermarket Vaults are designed to keep the calendar populated once live",
  },
  {
    n: 2,
    text: "At least 30% of subscriptions become oversubscribed (creates boost premium)",
    how: "Curation and community growth; measured on-chain post-launch",
  },
  {
    n: 3,
    text: "Boost impact is legible to every user before subscribing",
    how: "Side-by-side USD comparison shown on subscribe screen",
  },
  {
    n: 4,
    text: "Aftermarket price of subscribed tokens outperforms USDG hold",
    how: "Chainlink-tracked realized returns measured on-chain",
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
        description="A deliberate, checkable model for how RPO stays alive: five independent deal-flow sources (three controllable), a subscription mechanic that separates payment from priority, and a $RPO flywheel that pays holders in scarce IPO allocation rather than inflation. Pre-launch: no volume has flowed through this design yet."
      />

      <section className="section">
        <div className="container-wide">
          <div className="card p-6 border-l-4 border-peach-500 bg-peach-50/40">
            <Badge variant="peach">Pre-launch</Badge>
            <p className="text-sm text-ink-500 mt-3 leading-relaxed">
              RPO is not deployed. Everything below describes the intended
              design of the deal-flow, subscription, and flywheel loops.
              Every claim about live volume, revenue, or user counts has
              been removed from this page — those numbers do not exist yet.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-wide">
          <div className="eyebrow mb-4">01 · Deal Flow</div>
          <h2 className="font-display text-3xl lg:text-5xl text-ink-900 mb-6 max-w-3xl">
            Five independent sources. Two fully automatable. No single upstream bottleneck.
          </h2>
          <p className="text-ink-500 max-w-2xl mb-12 leading-relaxed text-lg">
            The single largest failure mode for any launchpad is running out
            of things to launch. RPO&apos;s design refuses to depend on any
            one upstream source. Even in a scenario where the RHJ pipeline
            freezes, Aftermarket vaults and Pons graduations keep the
            calendar dense enough that a wallet-connected user always has
            something meaningful to subscribe to.
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
                    <Badge variant="peach">planned</Badge>
                  </div>
                  <p className="text-ink-500 text-sm leading-relaxed">
                    {s.body}
                  </p>
                </div>
                <div className="space-y-3 lg:border-l lg:border-line lg:pl-6">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-mono mb-1">
                      Cadence
                    </div>
                    <div className="text-lg font-display text-ink-900">
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
        </div>
      </section>

      <section className="section border-t border-line bg-paper-100">
        <div className="container-wide">
          <div className="eyebrow mb-4">02 · Subscription Mechanics</div>
          <h2 className="font-display text-3xl lg:text-5xl text-ink-900 mb-6 max-w-3xl">
            USDG buys shares.{" "}
            <span className="italic text-peach-500">$RPO</span> buys priority.
          </h2>
          <p className="text-ink-500 max-w-2xl mb-12 leading-relaxed text-lg">
            Payment and priority are separated by design — anyone can
            participate with just USDG, but $RPO stakers earn a weight
            multiplier that matters when the IPO is oversubscribed.
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
                the actual capital that buys the underlying Stock Token when
                the vault fulfills. No RPO needed. No KYC. Fully refundable
                if the IPO doesn&apos;t list on time.
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
              Illustrative example
            </h3>
            <p className="text-ink-500 mb-8 max-w-3xl">
              Hypothetical: an IPO vault oversubscribed 3× (subscribed
              principal is triple the target). The vault fulfills only the
              target amount of shares, distributed pro-rata by weight.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-[0.14em] text-ink-500">
                    <th className="text-left py-3 pr-6 font-normal">Your $RPO position</th>
                    <th className="text-left py-3 px-6 font-normal">Boost</th>
                    <th className="text-left py-3 px-6 font-normal">Weight from $1,000</th>
                    <th className="text-left py-3 pl-6 font-normal">vs. no stake</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {[
                    { pos: "Not staked", boost: 1.0, weight: 1000, delta: null },
                    { pos: "0.1% of pool", boost: 1.06, weight: 1060, delta: 5.9 },
                    { pos: "1% of pool", boost: 1.20, weight: 1200, delta: 20.0 },
                    { pos: "10% of pool", boost: 1.63, weight: 1630, delta: 63.0 },
                    { pos: "25% of pool", boost: 2.00, weight: 2000, delta: 100.0 },
                    { pos: "100% of pool", boost: 3.00, weight: 3000, delta: 200.0 },
                  ].map((r) => (
                    <tr
                      key={r.pos}
                      className="border-b border-line last:border-0"
                    >
                      <td className="py-3 pr-6 text-ink-900 font-sans">{r.pos}</td>
                      <td className="py-3 px-6 text-ink-900">{r.boost.toFixed(2)}×</td>
                      <td className="py-3 px-6 text-ink-500">{r.weight.toLocaleString()}</td>
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
              . Capped at 3.00×. Square-root shape lets early stakers retain
              a meaningful advantage without letting a whale monopolize
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

      <section className="section">
        <div className="container-wide max-w-5xl">
          <div className="eyebrow mb-4">03 · The Flywheel</div>
          <h2 className="font-display text-3xl lg:text-5xl text-ink-900 mb-6">
            More IPOs → more $RPO demand → more IPOs.
          </h2>
          <p className="text-ink-500 max-w-2xl mb-12 leading-relaxed text-lg">
            The economic loop is deliberately narrow. Every unit of the
            flywheel reinforces the next. No inflation-based rewards, no
            unsustainable emissions.
          </p>

          <div className="card p-8 lg:p-12">
            <div className="grid gap-4 text-center">
              {[
                { step: "01", text: "More IPOs list on RPO", color: "bg-forest-50 text-forest-700" },
                { step: "02", text: "Oversubscription becomes common", color: "bg-forest-50 text-forest-700" },
                { step: "03", text: "Boost multiplier becomes economically valuable", color: "bg-forest-50 text-forest-700" },
                { step: "04", text: "Demand to hold + stake $RPO rises", color: "bg-peach-50 text-peach-600" },
                { step: "05", text: "Staked supply increases → circulating supply drops", color: "bg-peach-50 text-peach-600" },
                { step: "06", text: "Platform fees (in USDG) buy back $RPO", color: "bg-peach-50 text-peach-600" },
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
        </div>
      </section>

      <section className="section border-t border-line bg-paper-100">
        <div className="container-wide">
          <div className="eyebrow mb-4">04 · Failure Modes</div>
          <h2 className="font-display text-3xl lg:text-5xl text-ink-900 mb-6 max-w-3xl">
            Seven ways this could die. Seven planned mitigations.
          </h2>
          <p className="text-ink-500 max-w-2xl mb-12 leading-relaxed text-lg">
            No hand-waving. These are the specific failure modes we&apos;ve
            considered and the specific mitigations we&apos;ve either coded
            or planned. If you can name an eighth, open a GitHub discussion.
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

      <section className="section">
        <div className="container-wide max-w-4xl">
          <div className="eyebrow mb-4">05 · Success Conditions</div>
          <h2 className="font-display text-3xl lg:text-5xl text-ink-900 mb-6">
            Four checkable conditions.
          </h2>
          <p className="text-ink-500 mb-12 leading-relaxed text-lg">
            Rather than promising vague success, the protocol commits to
            four objective conditions. Once live, progress against them will
            be measurable directly on-chain.
          </p>

          <div className="space-y-4">
            {CONDITIONS.map((c) => (
              <div key={c.n} className="card p-6 flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  <div className="h-8 w-8 rounded-full bg-paper-200 border border-line text-ink-500 flex items-center justify-center font-mono text-xs">
                    {c.n}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-ink-900 font-semibold mb-1">
                    {c.text}
                  </div>
                  <div className="text-sm text-ink-500">{c.how}</div>
                </div>
                <div className="flex-shrink-0">
                  <Badge>Tracking</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight border-t border-line">
        <div className="container-wide max-w-4xl">
          <Prose>
            <H2 id="honest">A sober close</H2>
            <p>
              None of this guarantees RPO succeeds. Success requires the
              team to keep curating good IPOs, keep negotiating good primary
              allocations, keep operations tight, and keep the community
              informed. What the design does try to guarantee is that no
              single external failure — RHJ pausing tokenization, a bear
              market for IPOs, a bad regulator, a competitor launchpad —
              can kill the protocol overnight. There is always a next vault
              to open.
            </p>
            <H3 id="test-yourself">Test any claim yourself</H3>
            <ul>
              <li>
                Deal-flow claim → read the keeper source in{" "}
                <code>rpo/keeper/</code>.
              </li>
              <li>
                Boost formula → verify against{" "}
                <code>AllocationBooster.sol#getBoost</code>.
              </li>
              <li>
                Fee flow → once live, follow USDG from any real subscribe
                tx on <a href="/explorer">/explorer</a>.
              </li>
            </ul>
            <p>
              The protocol is designed so that nothing on this page has to
              be taken on faith once mainnet is live.
            </p>
          </Prose>
        </div>
      </section>
    </MarketingShell>
  );
}
