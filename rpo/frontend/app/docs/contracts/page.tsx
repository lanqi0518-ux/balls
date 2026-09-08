import { MarketingShell } from "@/components/marketing/MarketingShell";
import { DocLayout, TocItem } from "@/components/docs/DocLayout";
import { Prose } from "@/components/ui/Prose";
import { H2, H3 } from "@/components/ui/H";

export const metadata = {
  title: "Contract reference",
  description:
    "Solidity source, function signatures, and deployed addresses for every RPO contract.",
};

const toc: TocItem[] = [
  { id: "registry", label: "IPORegistry" },
  { id: "vault", label: "SubscriptionVault" },
  { id: "booster", label: "AllocationBooster" },
  { id: "rialto", label: "RialtoAdapter" },
  { id: "looper", label: "LeverageLooper" },
  { id: "addresses", label: "Deployed addresses" },
];

export default function ContractsPage() {
  return (
    <MarketingShell>
      <DocLayout
        meta={{
          eyebrow: "Reference · solidity",
          title: "Contract reference",
          subtitle:
            "Every RPO contract, its function surface, and its access-control matrix. Source lives at github.com/lanqi0518-ux/balls/tree/main/rpo/contracts.",
          updated: "March 2026",
        }}
        toc={toc}
        breadcrumbs={[
          { label: "docs", href: "/docs" },
          { label: "contracts" },
        ]}
      >
        <Prose>
          <H2 id="registry">IPORegistry</H2>
          <p>
            Factory + directory for SubscriptionVaults. CREATE2 salt is the
            ticker, so the vault address is knowable before deployment.
          </p>
          <table>
            <thead>
              <tr>
                <th>Function</th>
                <th>Access</th>
                <th>Effect</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>propose(bytes32 ticker, uint256 expectedPrice, uint256 target, uint64 subDeadline, uint64 fulfillDeadline)</code></td>
                <td>any (with 1k USDG bond)</td>
                <td>Deploys SubscriptionVault via CREATE2, records metadata.</td>
              </tr>
              <tr>
                <td><code>vaultOf(bytes32 ticker) → address</code></td>
                <td>view</td>
                <td>Deterministic address lookup.</td>
              </tr>
              <tr>
                <td><code>activeVaults() → address[]</code></td>
                <td>view</td>
                <td>Enumerates currently-open vaults.</td>
              </tr>
              <tr>
                <td><code>slashBond(bytes32 ticker)</code></td>
                <td>keeper</td>
                <td>Redistributes proposer bond to subscribers if vault fails to fill.</td>
              </tr>
            </tbody>
          </table>

          <H2 id="vault">SubscriptionVault</H2>
          <p>
            The core contract. One instance per IPO. Non-upgradable, no
            admin, no pause.
          </p>
          <H3 id="vault-write">Write functions</H3>
          <table>
            <thead>
              <tr>
                <th>Function</th>
                <th>Access</th>
                <th>Effect</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>subscribe(uint256 usdgAmount)</code></td>
                <td>any wallet, geo-blocked at UI</td>
                <td>Pulls USDG, deposits to Aave, records weighted claim.</td>
              </tr>
              <tr>
                <td><code>cancel()</code></td>
                <td>msg.sender only</td>
                <td>Withdraws USDG + accrued yield to msg.sender.</td>
              </tr>
              <tr>
                <td><code>fulfill(uint256 minTokensOut)</code></td>
                <td>keeper (after mint event) OR any wallet + 1h</td>
                <td>Buys Stock Token via RialtoAdapter, distributes pro-rata.</td>
              </tr>
              <tr>
                <td><code>claim()</code></td>
                <td>msg.sender only, post-fulfill</td>
                <td>Sends allocated Stock Token to msg.sender.</td>
              </tr>
              <tr>
                <td><code>refund()</code></td>
                <td>any wallet, post-fulfillment-deadline</td>
                <td>Refunds all subscribers 100% + Aave yield.</td>
              </tr>
            </tbody>
          </table>
          <H3 id="vault-view">Read functions</H3>
          <ul>
            <li><code>subscribedOf(address) → uint256</code> — USDG contributed.</li>
            <li><code>weightOf(address) → uint256</code> — subscribed × boost snapshot.</li>
            <li><code>totalSubscribed() → uint256</code></li>
            <li><code>status() → Status</code> — enum: Subscribing, Fulfilled, Refunded.</li>
          </ul>

          <H2 id="booster">AllocationBooster</H2>
          <p>
            Stakes $RPO and exposes <code>boostOf(address)</code> to any
            SubscriptionVault. Cooldown is 14 days on unstake.
          </p>
          <pre>
            <code>{`function stake(uint256 amount) external;
function unstake(uint256 amount) external;   // starts 14d cooldown
function withdraw() external;                 // after cooldown
function boostOf(address user) external view returns (uint256 bps);`}</code>
          </pre>
          <p>
            <code>boostOf</code> returns basis points where 10000 = 1.00×.
            Fixed-point math avoids ABDK/Sol-math dependencies.
          </p>

          <H2 id="rialto">RialtoAdapter</H2>
          <p>
            Router between vaults and fill venues. Enforces{" "}
            <code>maxSlippageBps</code> and falls back Rialto → Uniswap V3
            if Chainlink deviates &gt; 30 bps.
          </p>
          <pre>
            <code>{`function buy(
    address token,
    uint256 usdgAmount,
    uint256 minTokensOut,
    uint256 maxSlippageBps
) external returns (uint256 tokensOut);

function sell(
    address token,
    uint256 tokenAmount,
    uint256 minUsdgOut
) external returns (uint256 usdgOut);`}</code>
          </pre>

          <H2 id="looper">LeverageLooper</H2>
          <p>
            One-shot helper: supply a Stock Token to Morpho Blue, borrow
            USDG, subscribe to a chosen vault. Health-factor check enforced
            per call. Users can partially deleverage by calling{" "}
            <code>repay(amount)</code> at any time.
          </p>
          <pre>
            <code>{`function loop(
    address collateral,
    uint256 collateralAmount,
    uint256 targetLtvBps,
    bytes32 subscribeToTicker
) external returns (uint256 borrowed, uint256 subscribed);`}</code>
          </pre>

          <H2 id="addresses">Deployed addresses</H2>
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Robinhood Chain (4663)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>IPORegistry</td><td><code>0xREG0…0001</code></td></tr>
              <tr><td>AllocationBooster</td><td><code>0xB005…7002</code></td></tr>
              <tr><td>RialtoAdapter</td><td><code>0xADAP…7003</code></td></tr>
              <tr><td>LeverageLooper</td><td><code>0xL00P…7004</code></td></tr>
              <tr><td>FeeCollector</td><td><code>0xFEE0…7005</code></td></tr>
              <tr><td>$RPO Token</td><td><code>0xR90…B902</code></td></tr>
              <tr><td>Timelock</td><td><code>0x1FC0…3388</code></td></tr>
            </tbody>
          </table>
          <p>
            Machine-readable JSON at{" "}
            <a href="https://github.com/lanqi0518-ux/balls/blob/main/rpo/contracts/addresses.robinhood.json">
              /rpo/contracts/addresses.robinhood.json
            </a>
            .
          </p>
        </Prose>
      </DocLayout>
    </MarketingShell>
  );
}
