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
    "RPO — the permissionless IPO subscription protocol. Technical whitepaper v1.0.",
};

const toc: TocItem[] = [
  { id: "abstract", label: "Abstract" },
  { id: "problem", label: "1. The IPO access problem" },
  { id: "rhc", label: "2. Robinhood Chain as native rails" },
  { id: "protocol", label: "3. Protocol architecture" },
  { id: "vault", label: "3.1 SubscriptionVault", depth: 3 },
  { id: "registry", label: "3.2 IPORegistry", depth: 3 },
  { id: "booster", label: "3.3 AllocationBooster", depth: 3 },
  { id: "rialto", label: "3.4 RialtoAdapter", depth: 3 },
  { id: "looper", label: "3.5 LeverageLooper", depth: 3 },
  { id: "token", label: "4. The $RPO token" },
  { id: "boost", label: "4.1 Boost curve", depth: 3 },
  { id: "flywheel", label: "4.2 Fee-to-buyback flywheel", depth: 3 },
  { id: "launch", label: "5. Fair launch on Pons" },
  { id: "bridging", label: "6. Cross-chain via LiFi" },
  { id: "security", label: "7. Security model" },
  { id: "governance", label: "8. Governance" },
  { id: "regulatory", label: "9. Regulatory posture" },
  { id: "roadmap", label: "10. Roadmap" },
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
            "A technical description of how RPO turns Robinhood's tokenized Stock Tokens into a globally-accessible primary market — powered by Rialto propAMM, ERC-8056, Morpho Blue, and a $RPO-weighted allocation booster.",
          updated: "March 2026",
        }}
        toc={toc}
        breadcrumbs={[
          { label: "home", href: "/" },
          { label: "whitepaper" },
        ]}
        version="v1.0"
      >
        <Prose>
          {/* Downloads strip — visible at top, above the abstract */}
          <div className="not-prose mb-10 rounded-2xl border border-line bg-paper-100 p-5 grid sm:grid-cols-[1fr_auto] gap-4 items-center">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs font-mono min-w-0">
              <div className="text-ink-500">Version</div>
              <div className="text-ink-900">
                {WHITEPAPER.version} · {WHITEPAPER.releasedAt}
              </div>
              <div className="text-ink-500">SHA-256</div>
              <div className="text-ink-900 truncate">{WHITEPAPER.sha256}</div>
              <div className="text-ink-500">IPFS</div>
              <div className="text-ink-900 truncate">
                <a
                  href={`https://ipfs.io/ipfs/${WHITEPAPER.ipfsCid}`}
                  className="hover:underline"
                >
                  {WHITEPAPER.ipfsCid}
                </a>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <a href={WHITEPAPER.pdfUrl} className="btn-primary text-sm">
                Download PDF
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <a
                href={`https://ipfs.io/ipfs/${WHITEPAPER.ipfsCid}`}
                className="btn-secondary text-sm"
              >
                Read on IPFS
              </a>
            </div>
          </div>

          <H2 id="abstract">Abstract</H2>
          <p>
            <strong>RPO</strong> is a fully on-chain protocol that lets any
            wallet subscribe to real US-listed IPOs the same way accredited
            investors do through investment banks — but with no broker
            relationship, no book-runner allocation politics, and no minimum
            check size beyond a single dollar of USDG. RPO leverages
            three primitives that only exist because{" "}
            <a href="https://www.robinhood.com/blog/robinhood-chain-mainnet">
              Robinhood Chain
            </a>{" "}
            went live: (i) the <em>Rialto propAMM</em>, a market-maker-backed
            AMM that provides primary-market pricing on every listed Stock
            Token; (ii) <em>ERC-8056</em>, a scaled-UI amount token standard
            that natively encodes corporate actions like splits and dividends;
            and (iii) <em>Chainlink total-return feeds</em>, canonical price
            oracles maintained by Robinhood&apos;s market data operation.
            RPO composes these into a subscription vault system that can be
            spun up permissionlessly for any newly-listed Stock Token,
            allocated pro-rata plus a $RPO-weighted boost, and fulfilled
            atomically the moment RHJ mints the underlying supply. The
            protocol carries no admin key, no upgrade path, and no legal
            entity between the user and the underlying Reg-S debt security.
          </p>

          <H2 id="problem">1. The IPO access problem</H2>
          <p>
            Retail investors cannot subscribe to modern IPOs. This is not a
            technology problem — it is a distribution problem baked into 40
            years of book-building convention. When a company goes public
            through Goldman, Morgan Stanley or JPMorgan, the underwriters
            hand-allocate ~85% of the offering to institutional accounts and
            reserve the remainder for internal high-net-worth channels. By
            the time the stock opens on NYSE or Nasdaq the pop that would
            have accrued to a retail subscriber — historically ~18% on the
            first day of trading — has already been captured by
            allocation-tier investors.
          </p>
          <p>
            Robinhood&apos;s IPO Access product partially addresses this by
            requesting shares from underwriters and lotterying them to
            eligible users. But it inherits every constraint of the
            traditional system: the pool is small (typically single-digit
            millions), the geography is limited to US brokerage accounts, and
            the fulfillment logic is opaque. No non-US investor and no
            non-Robinhood-user can participate at all.
          </p>
          <p>
            RPO takes a different approach: instead of asking underwriters
            for allocation, it builds a shadow primary market on top of
            Robinhood&apos;s own tokenized issuance stack. Every US-listed
            equity that RHJ (Robinhood Assets Jersey) mints as a Reg-S Stock
            Token is a fresh supply event; RPO&apos;s SubscriptionVaults
            pre-commit capital to buy that supply the moment it is minted,
            through Rialto&apos;s propAMM, at prices that mirror the primary
            book. The result is a permissionless subscription rail with
            global reach and single-digit-cent minimums.
          </p>

          <H2 id="rhc">2. Robinhood Chain as native rails</H2>
          <p>
            Robinhood Chain is an{" "}
            <strong>Arbitrum Orbit L2 (chain id 4663)</strong> optimised for
            settlement of tokenized securities. Three of its properties are
            load-bearing for RPO:
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
            Because gas is denominated in ETH bridged from L1 and block time
            is 250ms, a full subscribe→fill→claim round trip settles in under
            a second and costs less than $0.01 in gas. This is a material
            precondition for making IPO subscription usable at $1
            granularity.
          </p>

          <H2 id="protocol">3. Protocol architecture</H2>
          <p>
            RPO is built from five contracts. They are deployed once,
            ownership is immediately renounced (with the exception of
            keeper roles on <code>RialtoAdapter</code> and{" "}
            <code>IPORegistry</code>, which are handed to a Gnosis Safe
            controlled by the DAO), and they interoperate through pure
            function calls with no admin-controlled parameters.
          </p>

          <ArchitectureDiagram className="my-8" />

          <H3 id="vault">3.1 SubscriptionVault</H3>
          <p>
            One <code>SubscriptionVault</code> is deployed per IPO via
            CREATE2 with the ticker as salt, giving every IPO a deterministic
            address that can be shared and verified before the corresponding
            Stock Token even exists. During the subscription window, users
            call <code>subscribe(uint256 usdgAmount)</code> and the vault
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
            <code>RialtoAdapter.buy()</code>; (iii) distributes the received
            Stock Token pro-rata by weight; (iv) forwards a 2% platform fee
            to <code>FeeCollector</code>. Any subscriber can then call{" "}
            <code>claim()</code> to withdraw their allocation.
          </p>
          <p>
            If RHJ does not list the underlying by the vault&apos;s{" "}
            <code>fulfillmentDeadline</code>, <em>anyone</em> can call{" "}
            <code>refund()</code>. Every subscriber gets 100% of their USDG
            back plus accrued Aave yield. This is a hard-coded property with
            no override — the vault cannot be extended, paused, or drained
            by governance.
          </p>

          <H3 id="registry">3.2 IPORegistry</H3>
          <p>
            <code>IPORegistry</code> is the factory. It exposes{" "}
            <code>propose(bytes32 ticker, uint256 expectedPrice, uint256 target, uint64 subDeadline, uint64 fulfillDeadline)</code>{" "}
            which any address can call by posting a $1,000 USDG bond. If the
            proposed IPO fills to at least 50% of target, the bond is
            returned; if it fails to fill, the bond is slashed and
            distributed pro-rata to actual subscribers of that vault as
            compensation for opportunity cost. This is the anti-spam
            mechanism that keeps the calendar clean without introducing a
            gatekeeper.
          </p>

          <H3 id="booster">3.3 AllocationBooster</H3>
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
            whales cannot monopolize allocation — a user staking 100× more
            than average gets only ~2.5× the boost of the median staker,
            not 100×. Unstaking triggers a 14-day cooldown during which the
            boost decays linearly.
          </p>

          <H3 id="rialto">3.4 RialtoAdapter</H3>
          <p>
            RialtoAdapter is a thin router that abstracts the fill venue.
            Its default path is <code>IRialtoRouter.exactInput</code> which
            hits the propAMM directly. When the propAMM&apos;s displayed
            quote deviates from Chainlink by more than 30 bps (indicating
            the market-maker is offline or spread-widening), the adapter
            falls back to the Uniswap Universal Router and routes through
            the USDG↔Stock-Token V3 pool that Rialto seeds. In practice
            the fallback path is only hit during scheduled maintenance
            windows.
          </p>

          <H3 id="looper">3.5 LeverageLooper</H3>
          <p>
            After a fulfilled IPO, users can deposit their newly-received
            Stock Token into <code>LeverageLooper.loop()</code>. The looper:
          </p>
          <ol>
            <li>Supplies the token to Morpho Blue as collateral.</li>
            <li>
              Borrows USDG at the current market rate up to a configurable
              LTV (default 60%, capped at Morpho&apos;s market LLTV minus
              5% for safety).
            </li>
            <li>
              Subscribes the borrowed USDG to the next open{" "}
              <code>SubscriptionVault</code>, still tagged to the user.
            </li>
          </ol>
          <p>
            This gives the user a capital-efficient IPO ladder: every filled
            allocation immediately becomes collateral for the next one.
            Health factor is monitored by a Gelato-triggered liquidation
            script; users can also add USDG to the position at any time to
            deleverage.
          </p>

          <H2 id="token">4. The $RPO token</H2>
          <p>
            $RPO is the protocol token. It has a fixed supply of{" "}
            <strong>1,000,000,000</strong> and was launched fair on{" "}
            <a href="https://pons.dev">Pons</a> paired against SPY (a
            tokenized S&amp;P 500 exposure denominated in USDG). There is no
            team allocation vesting cliff and no VC round.
          </p>

          <H3 id="boost">4.1 Boost curve</H3>
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
              any individual is bounded, regardless of stake, so a large
              staker cannot buy the entire IPO.
            </li>
          </ul>
          <p>
            An accompanying Dune board tracks the median and 90th-percentile
            boost every epoch.
          </p>

          <H3 id="flywheel">4.2 Fee-to-buyback flywheel</H3>
          <p>
            RPO charges a flat 2% fee on every filled subscription. 80% of
            fee revenue is spent on open-market $RPO buybacks through the
            Pons LP; the acquired $RPO is streamed back into{" "}
            <code>AllocationBooster</code> as protocol accrual, weighted by
            each staker&apos;s time-integrated stake. The remaining 20% is
            allocated to a{" "}
            <strong>protocol-owned liquidity vault</strong> that seeds Pons
            LPs for newly-listed Stock Tokens, deepening the propAMM
            fallback path.
          </p>

          <H2 id="launch">5. Fair launch on Pons</H2>
          <p>
            $RPO launched on the <a href="https://pons.dev">Pons launchpad</a>
            {" "}with the following configuration: bonding-curve start price
            $0.00042, graduation threshold $69,420 in SPY (denominated as
            5.24 SPY units), no snipe tax, no team allocation, no whitelist.
            The token graduated to Uniswap V4 with the LP fully burned; the
            resulting SPY↔$RPO pool is the canonical trading venue.
          </p>

          <H2 id="bridging">6. Cross-chain via LiFi</H2>
          <p>
            Users bridging in from Ethereum, Base or Arbitrum interact with
            the <code>LiFiWidget</code> embedded in the subscribe form. The
            widget quotes USDC → USDG (via a Rialto-operated bridge for
            USDC-Base and USDC-Arbitrum, and via Squid Router for ETH
            mainnet) and executes the bridge + <code>subscribe</code> in a
            single meta-transaction relayed through Biconomy. From the user
            perspective there is no chain switching and no wallet-level
            approval to sign twice.
          </p>

          <H2 id="security">7. Security model</H2>
          <p>
            RPO&apos;s security guarantees rest on four assumptions, listed
            in decreasing order of trust required:
          </p>
          <ol>
            <li>
              <strong>Robinhood Chain is live and non-reorgable.</strong>{" "}
              Sequenced by Robinhood with a 7-day escape hatch to L1.
            </li>
            <li>
              <strong>Chainlink TR feeds are correct and timely.</strong>{" "}
              Deviations &gt; 30 bps trigger the Rialto→Uniswap fallback and
              subscribers can always cancel until <code>fulfill()</code>.
            </li>
            <li>
              <strong>Rialto&apos;s propAMM does not front-run vault fills.</strong>{" "}
              Enforced by (a) commit-reveal on fulfillment price and (b) a
              max-slippage parameter enforced at the vault level.
            </li>
            <li>
              <strong>The keeper is live within the fulfillment window.</strong>{" "}
              Enforced by (a) 10 independent Gelato-executor accounts each
              with a bond and (b) permissionless{" "}
              <code>fulfill()</code>: any address can call it after 1 hour
              from RHJ&apos;s mint event and be reimbursed for gas + a 10
              bps of vault size finder&apos;s fee.
            </li>
          </ol>
          <p>
            All contracts are non-upgradable. Audit reports are published on{" "}
            <a href="/audits">/audits</a> and the bug bounty is on{" "}
            <a href="/bounty">/bounty</a>.
          </p>

          <H2 id="governance">8. Governance</H2>
          <p>
            RPO is governed by a{" "}
            <strong>Compound-style GovernorBravo</strong> plus a 48-hour
            OpenZeppelin timelock. Proposals require 250,000 $RPO worth of
            voting weight to submit and a quorum of 4% of circulating supply
            to pass. Voting weight is <code>staked_RPO + 0.25 × liquid_RPO</code>,
            so stakers dominate but liquid holders can still block
            malicious proposals.
          </p>
          <p>
            The scope of on-chain governance is deliberately narrow:
          </p>
          <ul>
            <li>Setting the platform fee (bounded 0-3%).</li>
            <li>
              Rotating the Rialto keeper set and Gnosis Safe signers on
              non-critical roles.
            </li>
            <li>Approving new fill venues (e.g. adding a new AMM).</li>
            <li>
              Allocating the treasury share of buyback proceeds to grants
              (see <a href="/grants">/grants</a>).
            </li>
          </ul>
          <p>
            The following are <em>not</em> governable and are hard-coded:
            SubscriptionVault refund logic, the boost curve, and the fixed
            $RPO supply.
          </p>

          <H2 id="regulatory">9. Regulatory posture</H2>
          <p>
            Robinhood Stock Tokens are{" "}
            <strong>Reg-S debt securities</strong> issued by Robinhood
            Assets (Jersey) Limited (&quot;RHJ&quot;). Under Regulation S they
            may not be offered or sold to US persons, Canadian residents,
            UK residents, Swiss residents, or UAE residents. RPO enforces
            this at the front-end level via a geo-block that reads the
            wallet&apos;s IP through a Cloudflare Workers geofence and — for
            wallets that connect through the Privy embedded-wallet flow —
            checks the underlying login geography.
          </p>
          <p>
            Because RPO&apos;s smart contracts are unowned, immutable, and
            do not custody user funds beyond the vault lifecycle, RPO Labs
            takes the position that the protocol itself is not a broker,
            money-transmitter, or securities issuer. This position is
            documented and defended in the{" "}
            <a href="/legal/risk">Risk Disclosure</a>.
          </p>

          <H2 id="roadmap">10. Roadmap</H2>
          <p>
            The protocol&apos;s trajectory is deliberately staged into four
            phases, each ending in a self-contained legal and technical
            deliverable. Full public plan at{" "}
            <a href="/roadmap">/roadmap</a>.
          </p>
          <table>
            <thead>
              <tr>
                <th>Phase</th>
                <th>Codename</th>
                <th>Legal path</th>
                <th>Who buys</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>00</td>
                <td>Subscribe</td>
                <td>None (reads RHJ Reg-S)</td>
                <td>Global non-US retail</td>
                <td>Shipped · Mar 2026</td>
              </tr>
              <tr>
                <td>01</td>
                <td>Issue · Reg-S</td>
                <td>Regulation S + Cayman SPV</td>
                <td>Global non-US retail</td>
                <td>Q3 2026</td>
              </tr>
              <tr>
                <td>02</td>
                <td>Issue · Reg-D</td>
                <td>Reg-D 506(c) + accredited SBT</td>
                <td>Accredited investors globally</td>
                <td>Q4 2026</td>
              </tr>
              <tr>
                <td>03</td>
                <td>Issue · Reg-A+</td>
                <td>Reg-A Tier 2 + SEC qualification</td>
                <td>US retail + global</td>
                <td>Q2 2027</td>
              </tr>
              <tr>
                <td>04</td>
                <td>Compete</td>
                <td>S-1 + FINRA ATS + Transfer Agent</td>
                <td>Every public-market participant</td>
                <td>2027 – 2028</td>
              </tr>
            </tbody>
          </table>
          <p>
            The three new contract modules delivered across phases 01 → 04
            —{" "}
            <code>IssuanceFactory</code>,{" "}
            <code>TransferPolicy</code> (ERC-3643), and{" "}
            <code>CapTable</code> — are described in detail on the{" "}
            <a href="/roadmap#modules">roadmap page</a>. All new modules
            inherit the same non-upgradable, no-admin, permissionless-refund
            posture as the current five contracts.
          </p>

          <H2 id="references">References</H2>
          <ol>
            <li>
              Robinhood Markets, Inc. &quot;Robinhood Chain: architecture
              paper.&quot; 2026.
            </li>
            <li>
              Chainlink Labs. &quot;Total Return Reference Feeds for
              Tokenized Equities.&quot; 2025.
            </li>
            <li>
              EIP-8056: Scaled UI Amount Extension for ERC-20. Draft, 2025.
            </li>
            <li>
              Morpho Association. &quot;Morpho Blue.&quot; 2024.
            </li>
            <li>
              Pons Labs. &quot;Bonding-curve launchpads: a survey.&quot;
              2025.
            </li>
            <li>
              Ritter, Jay. &quot;IPOs and First-Day Returns 1980-2024.&quot;{" "}
              <em>University of Florida Working Paper</em>, 2025.
            </li>
          </ol>
        </Prose>
      </DocLayout>
    </MarketingShell>
  );
}
