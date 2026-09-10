import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Prose } from "@/components/ui/Prose";
import { H2 } from "@/components/ui/H";
import { Badge } from "@/components/ui/Badge";

export const metadata = {
  title: "Governance",
  description:
    "Designed governance: Compound-style Governor + 48h OpenZeppelin timelock. No proposals yet — RPO is pre-launch.",
};

export default function GovernancePage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Governance"
        title="Narrow scope. Real teeth."
        description="RPO's Governor is designed to adjust a handful of protocol parameters and disburse the treasury. It cannot upgrade contracts, freeze funds, or change refund logic — those are hard-coded. Nothing is live yet: the parameters below describe the intended launch configuration."
      />

      <section className="section">
        <div className="container-wide">
          <div className="card p-6 border-l-4 border-peach-500 bg-peach-50/40">
            <Badge variant="peach">Pre-launch</Badge>
            <p className="text-sm text-ink-500 mt-3 leading-relaxed">
              No Governor, Timelock, or $RPO voting weight is deployed. No
              proposals have been submitted. This page will populate with
              live proposals and delegate profiles from the deployed
              contracts once launch happens.
            </p>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container-wide grid md:grid-cols-4 gap-4">
          {[
            { k: "Proposal threshold", v: "250,000 $RPO" },
            { k: "Quorum", v: "4% of circulating" },
            { k: "Voting period", v: "5 days" },
            { k: "Timelock delay", v: "48 hours" },
          ].map((s) => (
            <div key={s.k} className="card p-6">
              <div className="text-[11px] uppercase tracking-[0.22em] text-ink-500 mb-3">
                {s.k}
              </div>
              <div className="font-display text-2xl text-ink-900 tabular-nums">{s.v}</div>
              <div className="text-[10px] text-ink-500 mt-2 font-mono">
                target · not yet live
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section border-t border-line">
        <div className="container-wide max-w-4xl">
          <Prose>
            <H2 id="scope">Scope</H2>
            <p>
              On-chain governance is deliberately narrow. The Governor will
              be able to:
            </p>
            <ul>
              <li>Set the platform fee, bounded between 0% and 3%.</li>
              <li>
                Approve new fill venues for <code>RialtoAdapter</code>{" "}
                (e.g. adding a new AMM).
              </li>
              <li>
                Rotate the Rialto keeper set and multisig signers on
                non-critical operational roles.
              </li>
              <li>
                Allocate the treasury share of buyback proceeds to
                bounty top-ups and protocol-owned liquidity.
              </li>
              <li>
                Add or remove tokens from the LeverageLooper collateral
                whitelist, up to LLTV caps enforced by Morpho Blue.
              </li>
            </ul>
            <p>
              The Governor <em>cannot</em>:
            </p>
            <ul>
              <li>Change SubscriptionVault refund logic.</li>
              <li>Modify the boost curve.</li>
              <li>Alter the $RPO supply cap.</li>
              <li>
                Upgrade any contract — every contract is deployed with{" "}
                <code>selfdestruct</code> removed and no proxy pattern.
              </li>
              <li>Pause, freeze or drain any user funds.</li>
            </ul>

            <H2 id="voting">Voting weight</H2>
            <p>
              Voting weight is computed as{" "}
              <code>staked_RPO + 0.25 × liquid_RPO</code>. This means:
            </p>
            <ul>
              <li>
                Committed stakers get 4× the political weight of passive
                holders per token, matching their exposure to protocol
                outcomes.
              </li>
              <li>
                Liquid holders retain enough weight to block malicious
                proposals if stakers are captured.
              </li>
              <li>
                Delegation will be supported via the standard OpenZeppelin{" "}
                <code>ERC20Votes</code> checkpoint pattern.
              </li>
            </ul>

            <H2 id="process">Proposal lifecycle</H2>
            <ol>
              <li>
                <strong>Discussion (7 days minimum).</strong> Any address
                can draft an RIP (RPO Improvement Proposal) in the
                community discussion channel (to be announced). Signal is
                gathered via non-binding snapshot poll.
              </li>
              <li>
                <strong>Submission.</strong> An address holding ≥ 250,000{" "}
                $RPO voting weight submits the proposal on-chain via{" "}
                <code>GovernorBravo.propose()</code>.
              </li>
              <li>
                <strong>Voting (5 days).</strong> Holders vote For, Against,
                or Abstain. Quorum is 4% of circulating supply.
              </li>
              <li>
                <strong>Timelock (48 hours).</strong> Passed proposals enter
                a 48-hour OpenZeppelin timelock before execution.
              </li>
              <li>
                <strong>Execution.</strong> After the timelock, anyone can
                call <code>execute()</code>.
              </li>
            </ol>

            <H2 id="delegates">Delegates</H2>
            <p>
              There is no delegate registry yet because there is no live
              token. Once $RPO is deployed and the Governor is live,
              delegate profiles will surface directly from on-chain
              checkpoints — no manually curated list will be maintained
              here.
            </p>
          </Prose>
        </div>
      </section>
    </MarketingShell>
  );
}
