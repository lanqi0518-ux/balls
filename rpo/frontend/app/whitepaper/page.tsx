import { MarketingShell } from "@/components/marketing/MarketingShell";
import { DocLayout, TocItem } from "@/components/docs/DocLayout";
import { Prose } from "@/components/ui/Prose";
import { H2, H3 } from "@/components/ui/H";
import { ArchitectureDiagram } from "@/components/marketing/ArchitectureDiagram";
import { WHITEPAPER } from "@/lib/version";
import { ArrowUpRight } from "@/components/ui/Icons";

export const metadata = {
  title: "Whitepaper",
  description:
    "RPO — the permissionless IPO subscription protocol. Technical whitepaper (draft).",
};

const REPO_URL = "https://github.com/lanqi0518-ux/balls";

const toc: TocItem[] = [
  { id: "abstract", label: "Abstract" },
  { id: "problem", label: "1. The IPO access problem" },
  { id: "rhc", label: "2. Robinhood Chain as native rails" },
  { id: "dealflow", label: "3. Deal-flow topology" },
  { id: "protocol", label: "4. Protocol architecture" },
  { id: "vault", label: "4.1 SubscriptionVault", depth: 3 },
  { id: "registry", label: "4.2 IPORegistry", depth: 3 },
  { id: "discovery", label: "4.3 AssetDiscovery", depth: 3 },
  { id: "booster", label: "4.4 AllocationBooster", depth: 3 },
  { id: "rialto", label: "4.5 RialtoAdapter", depth: 3 },
  { id: "looper", label: "4.6 LeverageLooper", depth: 3 },
  { id: "token", label: "5. The $RPO token" },
  { id: "boost", label: "5.1 Boost curve", depth: 3 },
  { id: "flywheel", label: "5.2 Fee-to-buyback flywheel", depth: 3 },
  { id: "launch", label: "6. Fair launch on Pons" },
  { id: "bridging", label: "7. Cross-chain via LiFi" },
  { id: "security", label: "8. Security model" },
  { id: "governance", label: "9. Governance" },
  { id: "regulatory", label: "10. Regulatory posture" },
  { id: "roadmap", label: "11. Roadmap" },
  { id: "references", label: "References" },
];

export default function WhitepaperPage() {
  return (
    <MarketingShell>
      <DocLayout
        meta={{
          eyebrow: "Whitepaper",
          title: "RPO: A permissionless IPO subscription protocol.",
          subtitle:
            "A technical description of how RPO is designed to turn Robinhood's tokenized Stock Tokens into a globally-accessible primary market — powered by Rialto propAMM, ERC-8056, Morpho Blue, and a $RPO-weighted allocation booster.",
          updated: "Draft — pre-launch",
        }}
        toc={toc}
        breadcrumbs={[
          { label: "home", href: "/" },
          { label: "whitepaper" },
        ]}
        version={WHITEPAPER.version}
      >
        <Prose>
          <div className="not-prose mb-10 rounded-2xl border border-line bg-paper-100 p-5 grid sm:grid-cols-[1fr_auto] gap-4 items-center">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono min-w-0">
              <div className="text-ink-500">Version</div>
              <div className="text-ink-900">
                {WHITEPAPER.version}
              </div>
              <div className="text-ink-500">Status</div>
              <div className="text-ink-900">
                Draft — not yet published as a signed PDF
              </div>
              <div className="text-ink-500">Source</div>
              <div className="text-ink-900 truncate">
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  github.com/lanqi0518-ux/balls
                </a>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-sm"
              >
                Repository
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <H2 id="abstract">Abstract</H2>
          <p>
            <strong>RPO</strong> is an on-chain protocol designed to let
            any wallet subscribe to real US-listed IPOs the same way
            accredited investors do through investment banks — but with no
            broker relationship, no book-runner allocation politics, and no
            minimum check size beyond a single dollar of USDG. RPO
            leverages three primitives available on{" "}
            <a href="https://www.robinhood.com/blog/robinhood-chain-mainnet">
              Robinhood Chain
            </a>
            : (i) the <em>Rialto propAMM</em>, a market-maker-backed AMM
            that provides primary-market pricing on every listed Stock
            Token; (ii) <em>ERC-8056</em>, a scaled-UI amount token
            standard that natively encodes corporate actions like splits
            and dividends; and (iii) <em>Chainlink total-return feeds</em>,
            canonical price oracles maintained by Robinhood&apos;s market
            data operation. RPO composes these into a subscription vault
            system that can be spun up permissionlessly for any newly-listed
            Stock Token, allocated pro-rata plus a $RPO-weighted boost, and
            fulfilled atomically the moment RHJ mints the underlying supply.
            The protocol is designed to carry no admin key, no upgrade
            path, and no legal entity between the user and the underlying
            Reg-S debt security.
          </p>

          <H2 id="problem">1. The IPO access problem</H2>
          <p>
            Retail investors cannot subscribe to modern IPOs. This is not a
            technology problem — it is a distribution problem baked into
            decades of book-building convention. When a company goes public
            through a bulge-bracket bank, the underwriters hand-allocate
            most of the offering to institutional accounts and reserve the
            remainder for internal high-net-worth channels. By the time
            the stock opens on NYSE or Nasdaq the first-day pop that would
            have accrued to a retail subscriber has already been captured
            by allocation-tier investors.
          </p>
          <p>
            Robinhood&apos;s IPO Access product partially addresses this
            by requesting shares from underwriters and lotterying them to
            eligible users. But it inherits every constraint of the
            traditional system: the pool is small, the geography is
            limited to US brokerage accounts, and the fulfillment logic is
            opaque. No non-US investor and no non-Robinhood-user can
            participate at all.
          </p>
          <p>
            RPO takes a different approach: instead of asking underwriters
            for allocation, it builds a shadow primary market on top of
            Robinhood&apos;s own tokenized issuance stack. Every US-listed
            equity that RHJ (Robinhood Assets Jersey) mints as a Reg-S
            Stock Token is a fresh supply event; RPO&apos;s
            SubscriptionVaults pre-commit capital to buy that supply the
            moment it is minted, through Rialto&apos;s propAMM, at prices
            that mirror the primary book. The result is a permissionless
            subscription rail with global reach and single-digit-cent
            minimums.
          </p>

          <H2 id="rhc">2. Robinhood Chain as native rails</H2>
          <p>
            Robinhood Chain is an{" "}
            <strong>Arbitrum Orbit L2 (chain id 4663)</strong> optimised
            for settlement of tokenized securities. Three of its properties
            are load-bearing for RPO:
          </p>
          <table>
            <thead>
              <tr>
                <th>Primitive</th>
                <th>What it is</th>
                <th>Why RPO needs it</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>ERC-8056</code>
                </td>
                <td>
                  Robinhood&apos;s token standard with a{" "}
                  <code>uiMultiplier()</code> field for share splits and
                  cash-equivalent corporate actions.
                </td>
                <td>
                  RPO doesn&apos;t need to rebase, re-issue or fork a token
                  when the underlying splits — the multiplier updates and
                  every downstream contract reads the new value.
                </td>
              </tr>
              <tr>
                <td>
                  <code>Rialto propAMM</code>
                </td>
                <td>
                  Two-sided AMM where a licensed prop desk continuously
                  quotes the full US Stock Token universe against Chainlink
                  reference prices.
                </td>
                <td>
                  Provides the fill venue for SubscriptionVaults — no
                  liquidity bootstrapping required for a new listing.
                </td>
              </tr>
              <tr>
                <td>
                  <code>Chainlink TR feeds</code>
                </td>
                <td>
                  Canonical price oracle for every listed Stock Token,
                  denominated in USDG and inclusive of{" "}
                  <code>uiMultiplier</code>.
                </td>
                <td>
                  Used to price vault fills, guard against toxic-flow front
                  runs, and mark Morpho Blue collateral in the LeverageLooper.
                </td>
              </tr>
              <tr>
                <td>
                  <code>USDG</code>
                </td>
                <td>
                  Robinhood&apos;s native stablecoin, mintable/redeemable
                  against USD at par by any Robinhood account.
                </td>
                <td>
                  Universal quote asset; also the pay-token accepted by every
                  SubscriptionVault.
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            Because gas is denominated in ETH bridged from L1 and block
            time is sub-second, a full subscribe→fill→claim round trip is
            designed to settle in under a second and cost a fraction of a
            cent in gas. This is a material precondition for making IPO
            subscription usable at $1 granularity.
          </p>

          <H2 id="dealflow">3. Deal-flow topology</H2>
          <p>
            RPO is a subscription rail, and a subscription rail is only as
            useful as its steady-state deal flow. A rail that opens one
            vault per week is theatre; a rail that opens hundreds per day
            is infrastructure. The protocol is therefore explicitly
            designed around{" "}
            <strong>four independent, non-correlated sources</strong> of
            new vaults, three of which are fully automated and one of
            which is human-curated.
          </p>
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Discovery mechanism</th>
                <th>Vault window</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>RHJ Reg-S Stock Tokens</strong>
                </td>
                <td>
                  Keeper polls the RHJ assets endpoint; diff against last
                  snapshot; call{" "}
                  <code>IPORegistry.propose(ticker)</code> on any new
                  asset.
                </td>
                <td>7 – 14 days</td>
              </tr>
              <tr>
                <td>
                  <strong>Aftermarket Vaults</strong>
                </td>
                <td>
                  One vault per RHJ-listed token, deployed permissionlessly
                  via <code>AssetDiscovery.openAftermarket(token)</code>.
                  Rotated every <code>AFTERMARKET_WINDOW</code>.
                </td>
                <td>Rolling</td>
              </tr>
              <tr>
                <td>
                  <strong>Pons Launchpad graduations</strong>
                </td>
                <td>
                  Keeper subscribes to the{" "}
                  <code>TokenGraduated(address, address pool)</code> event
                  on the Pons factory; every event triggers{" "}
                  <code>AssetDiscovery.openPonsGraduation(token)</code>.
                </td>
                <td>72h</td>
              </tr>
              <tr>
                <td>
                  <strong>Direct Reg-S / Reg-A+ / Reg-D</strong>
                </td>
                <td>
                  Manual <code>propose()</code> call by RPO Labs after
                  SPV or SEC-qualification legal review. Cap tables in{" "}
                  <code>CapTable.sol</code>.
                </td>
                <td>14 – 30 days</td>
              </tr>
            </tbody>
          </table>
          <p>
            The critical property is that the three automated pipelines
            are independent: a Robinhood listing freeze leaves Aftermarket
            + Pons unaffected, a Pons market collapse leaves RHJ +
            Aftermarket unaffected, and even a total shutdown of both
            external pipelines still leaves Aftermarket — every
            already-listed equity remains subscribable at Chainlink oracle
            pricing.
          </p>
          <p>
            <code>AssetDiscovery.sol</code> is the permissionless factory
            that carries the three automated pipelines. It has no owner
            and no upgrade path; anyone can call any of{" "}
            <code>openAftermarket</code>,{" "}
            <code>openPonsGraduation</code>, or the generic escape hatch{" "}
            <code>openGeneric</code>, provided the referenced token has a
            Chainlink feed.
          </p>

          <H2 id="protocol">4. Protocol architecture</H2>
          <p>
            RPO is built from five contracts. They are designed to be
            deployed once with ownership immediately renounced (with the
            exception of keeper roles on <code>RialtoAdapter</code> and{" "}
            <code>IPORegistry</code>, handed to a multisig controlled by
            the DAO), and to interoperate through pure function calls with
            no admin-controlled parameters.
          </p>

          <ArchitectureDiagram className="my-8" />

          <H3 id="vault">4.1 SubscriptionVault</H3>
          <p>
            One <code>SubscriptionVault</code> is deployed per IPO via
            CREATE2 with the ticker as salt, giving every IPO a
            deterministic address that can be shared and verified before
            the corresponding Stock Token even exists. During the
            subscription window, users call{" "}
            <code>subscribe(uint256 usdgAmount)</code> and the vault
            records a weighted claim <code>= amount × boost(msg.sender)</code>{" "}
            where <code>boost</code> is read from{" "}
            <code>AllocationBooster</code>. Idle USDG is deposited into an
            Aave v3 receipt token for the duration of the window so
            subscribers earn a base yield while waiting for the fulfillment.
          </p>
          <p>
            When RHJ mints the underlying supply, a keeper calls{" "}
            <code>fulfill(uint256 minTokensOut)</code>. The vault: (i)
            withdraws USDG from Aave; (ii) routes the buy through{" "}
            <code>RialtoAdapter.buy()</code>; (iii) distributes the
            received Stock Token pro-rata by weight; (iv) forwards a
            platform fee to <code>FeeCollector</code>. Any subscriber can
            then call <code>claim()</code> to withdraw their allocation.
          </p>
          <p>
            If RHJ does not list the underlying by the vault&apos;s{" "}
            <code>fulfillmentDeadline</code>, <em>anyone</em> can call{" "}
            <code>refund()</code>. Every subscriber gets 100% of their
            USDG back plus accrued Aave yield. This is a hard-coded
            property with no override — the vault cannot be extended,
            paused, or drained by governance.
          </p>

          <H3 id="registry">4.2 IPORegistry</H3>
          <p>
            <code>IPORegistry</code> is the factory. It exposes{" "}
            <code>propose(bytes32 ticker, uint256 expectedPrice, uint256 target, uint64 subDeadline, uint64 fulfillDeadline)</code>{" "}
            which any address can call by posting a USDG bond. If the
            proposed IPO fills to at least 50% of target, the bond is
            returned; if it fails to fill, the bond is slashed and
            distributed pro-rata to actual subscribers of that vault as
            compensation for opportunity cost. This is the anti-spam
            mechanism that keeps the calendar clean without introducing a
            gatekeeper.
          </p>

          <H3 id="discovery">4.3 AssetDiscovery</H3>
          <p>
            <code>AssetDiscovery</code> is the permissionless twin of{" "}
            <code>IPORegistry</code>. Where <code>IPORegistry</code>{" "}
            handles bonded, curated proposals (typically for RHJ Reg-S
            adds and Direct issuance), <code>AssetDiscovery</code> handles
            the programmatic bulk: any wallet can call{" "}
            <code>openAftermarket(token)</code>,{" "}
            <code>openPonsGraduation(token)</code>, or the generic escape
            hatch <code>openGeneric(token, windowSeconds)</code>. Each
            entry point applies a specific gate (RHJ whitelist, Pons
            graduation flag, or Chainlink-feed existence) and then deploys
            a <code>SubscriptionVault</code> via CREATE2 with a
            deterministic salt.
          </p>

          <H3 id="booster">4.4 AllocationBooster</H3>
          <p>
            $RPO holders can stake into <code>AllocationBooster</code> to
            earn a multiplier on their vault claims:
          </p>
          <pre>
            <code>{`boost(user) = min(3, 1 + 2 · sqrt(user.stake / totalStake))`}</code>
          </pre>
          <p>
            The square-root shape ensures that (a) small stakers get
            meaningful upside from the first token they lock, and (b)
            whales cannot monopolize allocation. Unstaking triggers a
            cooldown during which the boost decays linearly.
          </p>

          <H3 id="rialto">4.5 RialtoAdapter</H3>
          <p>
            RialtoAdapter is a thin router that abstracts the fill venue.
            Its default path is <code>IRialtoRouter.exactInput</code>{" "}
            which hits the propAMM directly. When the propAMM&apos;s
            displayed quote deviates from Chainlink beyond a configured
            band, the adapter falls back to a secondary venue.
          </p>

          <H3 id="looper">4.6 LeverageLooper</H3>
          <p>
            After a fulfilled IPO, users can deposit their newly-received
            Stock Token into <code>LeverageLooper.loop()</code>. The
            looper:
          </p>
          <ol>
            <li>Supplies the token to Morpho Blue as collateral.</li>
            <li>
              Borrows USDG at the current market rate up to a configurable
              LTV.
            </li>
            <li>
              Subscribes the borrowed USDG to the next open{" "}
              <code>SubscriptionVault</code>, still tagged to the user.
            </li>
          </ol>

          <H2 id="token">5. The $RPO token</H2>
          <p>
            $RPO is the protocol token. It is designed with a fixed supply
            of <strong>1,000,000,000</strong> and is intended to launch
            fair on <a href="https://pons.dev">Pons</a> paired against
            SPY (a tokenized S&amp;P 500 exposure denominated in USDG).
            There is no team allocation vesting cliff and no VC round.
            The token has not been minted.
          </p>

          <H3 id="boost">5.1 Boost curve</H3>
          <p>
            The staking-to-boost curve is a square-root because it
            provides the following invariants:
          </p>
          <ul>
            <li>
              A first-time staker with any positive stake immediately gets
              &gt;1× boost — no minimum-lockup gate.
            </li>
            <li>
              Doubling your stake never doubles your boost — whale-resistant.
            </li>
            <li>
              The cap at 3× guarantees that the boosted allocation share of
              any individual is bounded.
            </li>
          </ul>

          <H3 id="flywheel">5.2 Fee-to-buyback flywheel</H3>
          <p>
            RPO is designed to charge a flat 2% fee on every filled
            subscription. 80% of fee revenue is spent on open-market $RPO
            buybacks through the Pons LP; the acquired $RPO is streamed
            back into <code>AllocationBooster</code> as protocol accrual,
            weighted by each staker&apos;s time-integrated stake. The
            remaining 20% is allocated to a{" "}
            <strong>protocol-owned liquidity vault</strong>.
          </p>

          <H2 id="launch">6. Fair launch on Pons</H2>
          <p>
            $RPO is designed to launch on the{" "}
            <a href="https://pons.dev">Pons launchpad</a> with a fully
            fair bonding-curve configuration: no snipe tax, no team
            allocation, no whitelist. On graduation to Uniswap V4 the LP
            is intended to be fully burned.
          </p>

          <H2 id="bridging">7. Cross-chain via LiFi</H2>
          <p>
            Users bridging in from other chains interact with the{" "}
            <code>LiFiWidget</code> embedded in the subscribe form. The
            widget quotes USDC → USDG and executes the bridge +{" "}
            <code>subscribe</code> in a single meta-transaction. From the
            user perspective there is no chain switching and no
            wallet-level approval to sign twice.
          </p>

          <H2 id="security">8. Security model</H2>
          <p>
            RPO&apos;s security guarantees rest on four assumptions, listed
            in decreasing order of trust required:
          </p>
          <ol>
            <li>
              <strong>Robinhood Chain is live and non-reorgable.</strong>{" "}
              Sequenced by Robinhood with a scheduled escape hatch to L1.
            </li>
            <li>
              <strong>Chainlink TR feeds are correct and timely.</strong>{" "}
              Deviations trigger the Rialto→fallback path and subscribers
              can always cancel until <code>fulfill()</code>.
            </li>
            <li>
              <strong>Rialto&apos;s propAMM does not front-run vault fills.</strong>{" "}
              Enforced by (a) commit-reveal on fulfillment price and (b) a
              max-slippage parameter enforced at the vault level.
            </li>
            <li>
              <strong>The keeper is live within the fulfillment window.</strong>{" "}
              Enforced by independent executor accounts each with a bond
              and by permissionless <code>fulfill()</code>: any address
              can call it after a grace period.
            </li>
          </ol>
          <p>
            All contracts are designed to be non-upgradable. Audit reports
            will be published on <a href="/audits">/audits</a> and a bug
            bounty on <a href="/bounty">/bounty</a> when they exist.
          </p>

          <H2 id="governance">9. Governance</H2>
          <p>
            RPO is designed to be governed by a{" "}
            <strong>Compound-style GovernorBravo</strong> plus a 48-hour
            OpenZeppelin timelock. Proposals require 250,000 $RPO worth of
            voting weight to submit and a quorum of 4% of circulating
            supply to pass. Voting weight is{" "}
            <code>staked_RPO + 0.25 × liquid_RPO</code>, so stakers
            dominate but liquid holders can still block malicious proposals.
          </p>
          <p>
            The scope of on-chain governance is deliberately narrow:
          </p>
          <ul>
            <li>Setting the platform fee (bounded 0-3%).</li>
            <li>
              Rotating the Rialto keeper set and multisig signers on
              non-critical roles.
            </li>
            <li>Approving new fill venues (e.g. adding a new AMM).</li>
            <li>
              Allocating the treasury share of buyback proceeds to
              protocol-owned liquidity and bounty top-ups.
            </li>
          </ul>
          <p>
            The following are <em>not</em> governable and are hard-coded:
            SubscriptionVault refund logic, the boost curve, and the fixed
            $RPO supply.
          </p>

          <H2 id="regulatory">10. Regulatory posture</H2>
          <p>
            Robinhood Stock Tokens are{" "}
            <strong>Reg-S debt securities</strong> issued by Robinhood
            Assets (Jersey) Limited (&quot;RHJ&quot;). Under Regulation S
            they may not be offered or sold to US persons, Canadian
            residents, UK residents, Swiss residents, or UAE residents.
            RPO is designed to enforce this at the front-end level via a
            geo-block that reads the wallet&apos;s IP.
          </p>
          <p>
            Because RPO&apos;s smart contracts are designed to be unowned,
            immutable, and non-custodial beyond the vault lifecycle, the
            protocol itself is intended not to be a broker,
            money-transmitter, or securities issuer. This position will be
            documented in the <a href="/legal/risk">Risk Disclosure</a>.
          </p>

          <H2 id="roadmap">11. Roadmap</H2>
          <p>
            The protocol&apos;s intended trajectory is staged into four
            phases, each ending in a self-contained legal and technical
            deliverable. Full plan at <a href="/roadmap">/roadmap</a>.
          </p>
          <table>
            <thead>
              <tr>
                <th>Phase</th>
                <th>Codename</th>
                <th>Legal path</th>
                <th>Who buys</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>00</td>
                <td>Subscribe</td>
                <td>None (reads RHJ Reg-S)</td>
                <td>Global non-US retail</td>
              </tr>
              <tr>
                <td>01</td>
                <td>Issue · Reg-S</td>
                <td>Regulation S + Cayman/Jersey SPV</td>
                <td>Global non-US retail</td>
              </tr>
              <tr>
                <td>02</td>
                <td>Issue · Reg-D</td>
                <td>Reg-D 506(c) + accredited SBT</td>
                <td>Accredited investors globally</td>
              </tr>
              <tr>
                <td>03</td>
                <td>Issue · Reg-A+</td>
                <td>Reg-A Tier 2 + SEC qualification</td>
                <td>US retail + global</td>
              </tr>
              <tr>
                <td>04</td>
                <td>Compete</td>
                <td>S-1 + FINRA ATS + Transfer Agent</td>
                <td>Every public-market participant</td>
              </tr>
            </tbody>
          </table>

          <H2 id="references">References</H2>
          <ol>
            <li>Robinhood Markets, Inc. — Robinhood Chain public documentation.</li>
            <li>Chainlink Labs — Total Return Reference Feeds.</li>
            <li>EIP-8056 (draft) — Scaled UI Amount Extension.</li>
            <li>Morpho Association — Morpho Blue.</li>
            <li>Pons Labs — bonding-curve launchpad documentation.</li>
          </ol>
        </Prose>
      </DocLayout>
    </MarketingShell>
  );
}
