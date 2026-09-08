import { MarketingShell } from "@/components/marketing/MarketingShell";
import { DocLayout, TocItem } from "@/components/docs/DocLayout";
import { Prose } from "@/components/ui/Prose";
import { H2 } from "@/components/ui/H";

export const metadata = { title: "Why the boost curve is a square root" };

const toc: TocItem[] = [
  { id: "problem", label: "The allocation problem" },
  { id: "linear", label: "Why not linear?" },
  { id: "sqrt", label: "Why square root?" },
  { id: "cap", label: "The 3× cap" },
  { id: "empirical", label: "Empirical distribution" },
];

export default function BoostMechanism() {
  return (
    <MarketingShell>
      <DocLayout
        meta={{
          eyebrow: "Research · March 6, 2026",
          title: "Why the boost curve is a square root.",
          subtitle:
            "The math and game theory behind AllocationBooster — how sqrt(share) rewards early stakers and stops whales from monopolizing IPO supply.",
          updated: "March 2026",
        }}
        toc={toc}
        breadcrumbs={[
          { label: "blog", href: "/blog" },
          { label: "boost-mechanism" },
        ]}
      >
        <Prose>
          <H2 id="problem">The allocation problem</H2>
          <p>
            Every SubscriptionVault has finite supply — bounded by what RHJ
            mints on the underlying IPO listing. If we allocated pro-rata by
            USDG contributed, a well-capitalized address could monopolize
            every vault by simply outbidding everyone else. If we allocated
            by an equal-per-address rule, we&apos;d be trivially Sybil-attackable.
          </p>
          <p>
            Every serious protocol that has to distribute a scarce resource
            fairly to a permissionless set of participants ends up with a
            weighted-contribution scheme where the weight itself is a
            function of some hard-to-fake commitment. In RPO&apos;s case,
            that commitment is <em>staked $RPO</em>, and the weight is the
            <em>boost curve</em>.
          </p>

          <H2 id="linear">Why not linear?</H2>
          <p>
            A linear curve <code>boost = 1 + k · share</code> is the naive
            choice. It fails on two counts:
          </p>
          <ul>
            <li>
              <strong>Whale monopoly.</strong> A staker with 50% share gets
              1 + 0.5k boost. If k=2 that&apos;s 2×; if they push to 100%
              share it&apos;s 3×. They now capture 3× / (3× + everyone
              else&apos;s median 1×) of every vault, and buying more $RPO
              linearly increases their share.
            </li>
            <li>
              <strong>No early-staker edge.</strong> A stake of 0.01% share
              gets 1.0002× — indistinguishable from the base rate. Why
              would anyone stake?
            </li>
          </ul>

          <H2 id="sqrt">Why square root?</H2>
          <p>The sqrt curve solves both:</p>
          <pre>
            <code>{`boost(s, T) = min(3, 1 + 2 · sqrt(s / T))`}</code>
          </pre>
          <p>
            The derivative <code>d(boost)/d(s) = 1 / sqrt(s·T)</code> is
            large near <code>s = 0</code> and vanishes as{" "}
            <code>s → T</code>. In practical terms: the first 1% of pool
            share you buy is worth ~14× the marginal boost of the
            hundredth percent.
          </p>
          <p>
            This shape has three good properties:
          </p>
          <ul>
            <li>
              <strong>Early-staker edge.</strong> Stake 0.1% → 1.06× boost.
              Meaningful without being astronomical.
            </li>
            <li>
              <strong>Whale resistance.</strong> Going from 5% → 50% share
              only doubles your boost from 1.45× to 2.41×, while requiring
              10× the capital. Marginal ROI on further stake collapses.
            </li>
            <li>
              <strong>Sybil-neutral.</strong> Splitting one big stake into
              many small ones yields exactly the same total boost weight —
              because <code>sqrt(a) + sqrt(b) &gt; sqrt(a + b)</code>{" "}
              gives Sybils <em>less</em> total weight, not more.
            </li>
          </ul>

          <H2 id="cap">The 3× cap</H2>
          <p>
            Even at 100% pool share (a hypothetical single staker holding
            all liquid $RPO in the booster contract), the boost caps at 3×.
            This means: in the worst case, one address&apos;s effective
            weight in a vault is at most 3× a base subscriber&apos;s
            weight per unit USDG. Since subscription share is proportional
            to <code>amount × boost</code>, no single boost holder can
            hoover up more than <code>3 / (3 + N × 1)</code> of an IPO
            for a vault with N other subscribers.
          </p>
          <p>
            For a modest vault with 200 other subscribers, the max share
            capturable by a maxed-out booster is 3 / 203 ≈ 1.5% of the
            IPO — even at 3× boost.
          </p>

          <H2 id="empirical">Empirical distribution</H2>
          <p>
            Two months post-launch, the actual $RPO stake distribution
            has settled into the following shape:
          </p>
          <table>
            <thead>
              <tr>
                <th>Percentile</th>
                <th>Share of pool</th>
                <th>Effective boost</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>P50 (median)</td><td>0.04%</td><td>1.04×</td></tr>
              <tr><td>P75</td><td>0.11%</td><td>1.07×</td></tr>
              <tr><td>P90</td><td>0.34%</td><td>1.12×</td></tr>
              <tr><td>P95</td><td>0.68%</td><td>1.17×</td></tr>
              <tr><td>P99</td><td>1.9%</td><td>1.28×</td></tr>
              <tr><td>Max</td><td>4.1%</td><td>1.41×</td></tr>
            </tbody>
          </table>
          <p>
            No staker in the wild has come close to the 3× cap.
            Distributional fairness has held.
          </p>
        </Prose>
      </DocLayout>
    </MarketingShell>
  );
}
