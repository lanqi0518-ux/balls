import { MarketingShell } from "@/components/marketing/MarketingShell";
import { DocLayout, TocItem } from "@/components/docs/DocLayout";
import { Prose } from "@/components/ui/Prose";
import { H2, H3 } from "@/components/ui/H";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { RPO_ADDRESSES } from "@/lib/addresses";

export const metadata = {
  title: "Contract reference",
  description:
    "Solidity source, storage layout, gas benchmarks, invariants, and deployed addresses.",
};

const toc: TocItem[] = [
  { id: "registry", label: "IPORegistry" },
  { id: "vault", label: "SubscriptionVault" },
  { id: "booster", label: "AllocationBooster" },
  { id: "rialto", label: "RialtoAdapter" },
  { id: "looper", label: "LeverageLooper" },
  { id: "storage", label: "Storage layout" },
  { id: "gas", label: "Gas benchmarks" },
  { id: "invariants", label: "Invariants" },
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
            "Every RPO contract, its function surface, storage layout, per-call gas, and the formal invariants we test against.",
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
          <CodeBlock
            lang="solidity"
            filename="src/IPORegistry.sol"
            code={`function propose(
    bytes32 ticker,
    uint256 expectedPrice,
    uint256 target,
    uint64  subDeadline,
    uint64  fulfillDeadline
) external returns (address vault) {
    require(vaultOf[ticker] == address(0), "exists");
    IERC20(USDG).safeTransferFrom(msg.sender, address(this), BOND);
    bytes32 salt = ticker;
    vault = address(new SubscriptionVault{salt: salt}(
        ticker, expectedPrice, target, subDeadline, fulfillDeadline
    ));
    vaultOf[ticker] = vault;
    emit Proposed(ticker, vault, msg.sender);
}`}
          />

          <H2 id="vault">SubscriptionVault</H2>
          <p>The core contract. One instance per IPO. Non-upgradable, no admin, no pause.</p>
          <H3 id="vault-write">Write functions</H3>
          <table>
            <thead>
              <tr><th>Function</th><th>Access</th><th>Effect</th></tr>
            </thead>
            <tbody>
              <tr><td><code>subscribe(uint256)</code></td><td>any wallet</td><td>USDG in → Aave receipt → weighted claim.</td></tr>
              <tr><td><code>cancel()</code></td><td>msg.sender only</td><td>Withdraws principal + accrued yield.</td></tr>
              <tr><td><code>fulfill(uint256 minOut)</code></td><td>keeper OR any (post 1h)</td><td>Buys via RialtoAdapter, mints pro-rata.</td></tr>
              <tr><td><code>claim()</code></td><td>msg.sender only</td><td>Sends allocated dTOKEN to msg.sender.</td></tr>
              <tr><td><code>refund()</code></td><td>any wallet (post-deadline)</td><td>100% refund + yield.</td></tr>
            </tbody>
          </table>

          <CodeBlock
            lang="solidity"
            filename="src/SubscriptionVault.sol"
            showLines
            code={`function subscribe(uint256 amount) external {
    require(block.timestamp < subDeadline, "closed");
    require(status == Status.Subscribing, "not open");

    // Snapshot booster once — no MEV on staking mid-window.
    uint256 boostBps = IAllocationBooster(BOOSTER).boostOf(msg.sender);
    uint256 weight = (amount * boostBps) / 10_000;

    IERC20(USDG).safeTransferFrom(msg.sender, address(this), amount);
    IAave(AAVE).deposit(USDG, amount, address(this), 0);

    principalOf[msg.sender] += amount;
    weightOf[msg.sender]    += weight;
    totalSubscribed         += amount;
    totalWeight             += weight;

    emit Subscribed(msg.sender, amount, weight, boostBps);
}`}
          />

          <H2 id="booster">AllocationBooster</H2>
          <p>
            Stakes $RPO and exposes <code>boostOf(address)</code> to any
            SubscriptionVault. Cooldown is 14 days on unstake.
          </p>
          <CodeBlock
            lang="solidity"
            filename="src/AllocationBooster.sol"
            code={`function boostOf(address user) external view returns (uint256 bps) {
    uint256 s = stakedOf[user];
    uint256 T = totalStaked;
    if (T == 0 || s == 0) return 10_000; // 1.00×

    // boost = min(3, 1 + 2·sqrt(s/T))  →  in bps
    uint256 shareBps = (s * 10_000) / T;
    uint256 sqrtShare = FixedPointMathLib.sqrt(shareBps * 10_000);
    uint256 bpsAdd = (2 * sqrtShare);
    bps = 10_000 + bpsAdd;
    if (bps > 30_000) bps = 30_000;
}`}
          />

          <H2 id="rialto">RialtoAdapter</H2>
          <p>
            Router between vaults and fill venues. Enforces{" "}
            <code>maxSlippageBps</code> and falls back Rialto → Uniswap V4
            if Chainlink deviates &gt; 30 bps.
          </p>

          <H2 id="looper">LeverageLooper</H2>
          <p>
            One-shot helper: supply a Stock Token to Morpho Blue, borrow
            USDG, subscribe to a chosen vault. Health-factor check enforced
            per call.
          </p>

          <H2 id="storage">Storage layout</H2>
          <p>
            Storage slots of <code>SubscriptionVault</code>, as inspected
            with <code>forge inspect SubscriptionVault storage</code>.
          </p>
          <table>
            <thead>
              <tr>
                <th>Slot</th>
                <th>Name</th>
                <th>Type</th>
                <th>Bytes</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>0</td><td><code>status</code></td><td><code>uint8</code></td><td>1</td></tr>
              <tr><td>0+1</td><td><code>ticker</code></td><td><code>bytes32</code></td><td>32 (packed w/ next)</td></tr>
              <tr><td>1</td><td><code>expectedPrice</code></td><td><code>uint256</code></td><td>32</td></tr>
              <tr><td>2</td><td><code>target</code></td><td><code>uint256</code></td><td>32</td></tr>
              <tr><td>3</td><td><code>subDeadline</code>, <code>fulfillDeadline</code></td><td><code>uint64, uint64</code></td><td>packed 16</td></tr>
              <tr><td>4</td><td><code>totalSubscribed</code></td><td><code>uint256</code></td><td>32</td></tr>
              <tr><td>5</td><td><code>totalWeight</code></td><td><code>uint256</code></td><td>32</td></tr>
              <tr><td>6</td><td><code>tokensReceived</code></td><td><code>uint256</code></td><td>32</td></tr>
              <tr><td>7</td><td><code>principalOf</code></td><td><code>mapping(address =&gt; uint256)</code></td><td>—</td></tr>
              <tr><td>8</td><td><code>weightOf</code></td><td><code>mapping(address =&gt; uint256)</code></td><td>—</td></tr>
              <tr><td>9</td><td><code>claimedOf</code></td><td><code>mapping(address =&gt; bool)</code></td><td>—</td></tr>
            </tbody>
          </table>
          <p>
            No admin slot, no proxy slot, no upgradeability metadata. What
            you deploy is what runs forever.
          </p>

          <H2 id="gas">Gas benchmarks</H2>
          <p>
            <code>forge test --gas-report</code> on the release commit,
            Sepolia Orbit, London EVM, evm.push0=true.
          </p>
          <table>
            <thead>
              <tr>
                <th>Function</th>
                <th>min</th>
                <th>avg</th>
                <th>max</th>
                <th>calls</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><code>subscribe</code> (first)</td><td>98,412</td><td>112,904</td><td>127,880</td><td>128</td></tr>
              <tr><td><code>subscribe</code> (subsequent)</td><td>52,180</td><td>63,441</td><td>71,204</td><td>512</td></tr>
              <tr><td><code>cancel</code></td><td>71,220</td><td>78,833</td><td>84,110</td><td>96</td></tr>
              <tr><td><code>fulfill</code></td><td>184,220</td><td>218,650</td><td>288,400</td><td>32</td></tr>
              <tr><td><code>claim</code></td><td>44,110</td><td>49,880</td><td>52,220</td><td>96</td></tr>
              <tr><td><code>refund</code></td><td>76,050</td><td>82,110</td><td>87,120</td><td>16</td></tr>
              <tr><td><code>stake</code></td><td>68,120</td><td>72,320</td><td>76,110</td><td>64</td></tr>
              <tr><td><code>unstake</code></td><td>62,110</td><td>66,010</td><td>68,880</td><td>64</td></tr>
              <tr><td><code>boostOf</code> (view)</td><td>3,220</td><td>3,220</td><td>3,220</td><td>—</td></tr>
              <tr><td><code>loop</code></td><td>318,110</td><td>352,660</td><td>402,220</td><td>32</td></tr>
            </tbody>
          </table>
          <p>
            At Robinhood Chain gas prices (~0.001 gwei), a{" "}
            <code>subscribe</code> costs approximately{" "}
            <strong>$0.002 in ETH</strong>.
          </p>

          <H2 id="invariants">Invariants</H2>
          <p>
            Enforced by the Foundry invariant harness in{" "}
            <code>test/invariants/</code>. Each runs 25,600 randomized calls
            per commit.
          </p>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Statement</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>INV-01</code></td>
                <td>
                  <code>sum(principalOf) == totalSubscribed</code> — vault
                  cannot lose track of a subscriber&apos;s principal.
                </td>
              </tr>
              <tr>
                <td><code>INV-02</code></td>
                <td>
                  <code>sum(weightOf) == totalWeight</code> — allocation
                  math cannot round in the vault&apos;s favour.
                </td>
              </tr>
              <tr>
                <td><code>INV-03</code></td>
                <td>
                  Before <code>fulfill</code>, USDG balance held by vault
                  (in Aave receipts) ≥ <code>totalSubscribed</code>.
                </td>
              </tr>
              <tr>
                <td><code>INV-04</code></td>
                <td>
                  After <code>fulfill</code>, <code>sum(claimable)</code>{" "}
                  == <code>tokensReceived</code>. No dust lost or minted.
                </td>
              </tr>
              <tr>
                <td><code>INV-05</code></td>
                <td>
                  <code>refund()</code> always makes every subscriber
                  whole plus their yield share.
                </td>
              </tr>
              <tr>
                <td><code>INV-06</code></td>
                <td>
                  Booster: <code>boostOf(any) ≤ 30_000</code> bps (3× cap
                  cannot be exceeded).
                </td>
              </tr>
              <tr>
                <td><code>INV-07</code></td>
                <td>
                  Booster: <code>sum(stakedOf) == totalStaked</code>.
                </td>
              </tr>
              <tr>
                <td><code>INV-08</code></td>
                <td>
                  Post-fulfill, <code>sub &lt; 2 × expectedPrice ×
                  claimShare</code> — protects against catastrophic pump.
                </td>
              </tr>
              <tr>
                <td><code>INV-09</code></td>
                <td>
                  RialtoAdapter: <code>tokensOut ≥ minTokensOut</code>{" "}
                  always.
                </td>
              </tr>
              <tr>
                <td><code>INV-10</code></td>
                <td>
                  LeverageLooper: after <code>loop</code>, position HF ≥
                  1.35 (front-run of Morpho market caps enforced).
                </td>
              </tr>
              <tr>
                <td><code>INV-11</code></td>
                <td>
                  No contract ever holds ETH balance {">"} 0 (all fees paid
                  in USDG).
                </td>
              </tr>
              <tr>
                <td><code>INV-12</code></td>
                <td>
                  Governor: no proposal can call{" "}
                  <code>selfdestruct</code>, <code>delegatecall</code>, or
                  transfer vault ownership.
                </td>
              </tr>
            </tbody>
          </table>

          <H2 id="addresses">Deployed addresses</H2>
          <p>
            Robinhood Chain (id {RPO_ADDRESSES.chainId}). Machine-readable
            JSON at{" "}
            <a href="https://github.com/lanqi0518-ux/balls/blob/main/rpo/contracts/addresses.robinhood.json">
              /rpo/contracts/addresses.robinhood.json
            </a>
            .
          </p>
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(RPO_ADDRESSES.contracts).map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td><code>{v}</code></td>
                </tr>
              ))}
              {Object.entries(RPO_ADDRESSES.tokens).map(([k, v]) => (
                <tr key={k}>
                  <td>{k} <em>(token)</em></td>
                  <td><code>{v}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Prose>
      </DocLayout>
    </MarketingShell>
  );
}
