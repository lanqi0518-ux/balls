import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Prose } from "@/components/ui/Prose";
import { H2 } from "@/components/ui/H";
import { Badge } from "@/components/ui/Badge";

export const metadata = {
  title: "Governance",
  description:
    "How $RPO holders govern the protocol. Compound-style Governor + 48h OpenZeppelin timelock.",
};

const PROPOSALS = [
  {
    id: "RIP-004",
    title: "Approve Uniswap V4 as secondary fill venue",
    author: "0x9812…44A0",
    votes: { for: 4_820_000, against: 220_000, abstain: 60_000 },
    status: "Executed",
  },
  {
    id: "RIP-003",
    title: "Increase LeverageLooper LTV cap 60% → 65%",
    author: "harrison.eth",
    votes: { for: 3_100_000, against: 1_900_000, abstain: 40_000 },
    status: "Defeated",
  },
  {
    id: "RIP-002",
    title: "Allocate 2M $RPO to Q3 grants budget",
    author: "0x5C7F…AA02",
    votes: { for: 5_120_000, against: 90_000, abstain: 12_000 },
    status: "Executed",
  },
  {
    id: "RIP-001",
    title: "Lower proposal threshold 500k → 250k $RPO",
    author: "core",
    votes: { for: 6_400_000, against: 30_000, abstain: 5_000 },
    status: "Executed",
  },
];

export default function GovernancePage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Governance"
        title="Narrow scope. Real teeth."
        description="RPO's Governor can adjust a handful of protocol parameters and disburse the treasury. It cannot upgrade contracts, freeze funds, or change refund logic — those are hard-coded."
      />

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
            </div>
          ))}
        </div>
      </section>

      <section className="section-tight">
        <div className="container-wide">
          <div className="flex items-end justify-between mb-6">
            <h2 className="font-display text-3xl text-ink-900">Recent proposals</h2>
            <a
              href="https://tally.xyz/gov/rpo"
              className="text-sm text-forest-500 hover:underline"
            >
              View all on Tally →
            </a>
          </div>
          <div className="card divide-y divide-line">
            {PROPOSALS.map((p) => {
              const total = p.votes.for + p.votes.against + p.votes.abstain;
              const forPct = (p.votes.for / total) * 100;
              return (
                <div key={p.id} className="p-6 hover:bg-paper-100 transition-colors">
                  <div className="flex items-start gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="font-mono text-xs text-ink-500">
                          {p.id}
                        </span>
                        <Badge
                          variant={
                            p.status === "Executed"
                              ? "forest"
                              : p.status === "Defeated"
                              ? "default"
                              : "peach"
                          }
                          dot={p.status === "Executed"}
                        >
                          {p.status}
                        </Badge>
                      </div>
                      <div className="text-ink-900 font-semibold text-lg">
                        {p.title}
                      </div>
                      <div className="text-xs text-ink-500 mt-1 font-mono">
                        by {p.author}
                      </div>
                    </div>
                    <div className="w-80">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-forest-500 font-mono">
                          For · {(p.votes.for / 1e6).toFixed(2)}M
                        </span>
                        <span className="text-ink-500 font-mono">
                          Against · {(p.votes.against / 1e6).toFixed(2)}M
                        </span>
                      </div>
                      <div className="h-1.5 bg-paper-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-forest-500 rounded-full"
                          style={{ width: `${forPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section border-t border-line">
        <div className="container-wide max-w-4xl">
          <Prose>
            <H2 id="scope">Scope</H2>
            <p>
              On-chain governance is deliberately narrow. The Governor can:
            </p>
            <ul>
              <li>Set the platform fee, bounded between 0% and 3%.</li>
              <li>
                Approve new fill venues for <code>RialtoAdapter</code>{" "}
                (e.g. adding a new AMM).
              </li>
              <li>
                Rotate the Rialto keeper set and Gnosis Safe signers on
                non-critical operational roles.
              </li>
              <li>
                Allocate the treasury share of buyback proceeds to grants,
                bug bounty top-ups, and protocol-owned liquidity.
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
                Delegation is supported via the standard OpenZeppelin{" "}
                <code>ERC20Votes</code> checkpoint pattern.
              </li>
            </ul>

            <H2 id="process">Proposal lifecycle</H2>
            <ol>
              <li>
                <strong>Discussion (7 days minimum).</strong> Any address
                can post an RIP (RPO Improvement Proposal) to the{" "}
                <a href="https://forum.rpo.xyz">forum</a>. Signal is
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

            <H2 id="delegates">Trusted delegates</H2>
            <p>
              Community members with public delegation profiles can be
              found on{" "}
              <a href="https://tally.xyz/gov/rpo/delegates">Tally</a>.
              Notable current delegates:
            </p>
            <ul>
              <li>
                <strong>0xMaki.eth</strong> — 4.2% voting share, active
                delegate on 12/12 recent proposals.
              </li>
              <li>
                <strong>Blockworks Research</strong> — 3.6% voting share.
              </li>
              <li>
                <strong>Wintermute Labs</strong> — 2.9% voting share.
              </li>
            </ul>
          </Prose>
        </div>
      </section>
    </MarketingShell>
  );
}
