import type { Metadata } from "next";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Section, SectionHeader } from "@/components/ui/Section";
import { PrimitiveDeployBanner } from "@/components/hoodipo/PrimitiveDeployBanner";
import { CapCurve } from "@/components/hoodipo/CapCurve";
import { CONTRACTS } from "@/lib/chain";
import { Check, Shield } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "Anti-MEV fair launch · AntiSnipeHook",
  description:
    "HOODIPO's primitive 02. A Uniswap V4 hook that enforces a time-decaying per-swap size cap on freshly-minted Robinhood Stock Token pools, exempts PreMintVault claimants, and taxes JIT LPs — all with no admin.",
};

const RAILS = [
  {
    n: "01",
    tag: "Size cap",
    title: "Time-decaying per-swap USDG cap",
    body: "For the first ~30 minutes (900 blocks at 2s per block) the hook rejects any single swap larger than the current cap. Cap grows linearly from startCap → endCap, so the launch heats up over the window instead of clearing in one block.",
    code: `AntiSnipeHook.currentCap(poolId)
// e.g. cap(block  0)   = 1_000 USDG
//      cap(block  450) = 50_500 USDG
//      cap(block  900) = ∞    (rail off)`,
  },
  {
    n: "02",
    tag: "Claimant exemption",
    title: "PreMintVault claimants bypass the cap",
    body: "Wallets holding a receipt from any PreMintVault whose fulfill() lands in the same block as the initialize() call are exempt. They already committed capital during subscription; forcing them to race MEV searchers again would be double-punishment. The hook does an on-chain staticcall to PreMintFactory.hasClaimedAnyVault(swapper) — the exemption is impossible to spoof.",
    code: `if (preMintFactory.hasClaimedAnyVault(msg.sender)) {
    return beforeSwap.selector;  // no cap
}`,
  },
  {
    n: "03",
    tag: "JIT-LP tax",
    title: "Charge sandwich LPs on burn",
    body: "The classic V4 JIT sandwich mints tight-range liquidity right before a target swap, absorbs the fee, and burns immediately after. The hook records every LP's last add block; if remove happens within jitWindowBlocks (default 8) it charges jitTaxBps (default 300 = 3%) of the notional back to the fee collector. Any liquidity older than the window flows through untaxed.",
    code: `if (block.number - lastAddBlock[poolId][sender] <= jitWindowBlocks) {
    taxOwed = notionalUsdg * jitTaxBps / 10_000;
    emit JitTaxCharged(poolId, sender, taxOwed);
}`,
  },
];

const INVARIANTS = [
  "The size cap is a strictly monotonically increasing function of blocks since initialize. It can never tighten again.",
  "The exemption path is guarded by a staticcall — the hook cannot be tricked into whitelisting a wallet that never subscribed.",
  "startCap, endCap, capBlocks, jitTaxBps, jitWindowBlocks are all immutable. Once deployed, the hook's fair-launch profile is permanent.",
  "The JIT tax reverts to feeCollector only. There is no admin extraction path.",
  "The hook is stateless per pool (2 storage slots: initBlock + live). It never blocks trades for reasons other than the cap.",
];

export default function LaunchPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Primitive 02 · AntiSnipeHook (V4)"
        title={
          <>
            Fair launches, enforced by{" "}
            <span className="italic text-forest-500">solidity</span> — not by
            a whitelist.
          </>
        }
        description="Every new Robinhood Stock Token pool needs a fair-launch mechanism the block it initializes. HOODIPO ships one Uniswap V4 hook: a decaying per-swap size cap, an exemption for PreMintVault claimants, and a JIT-LP tax on sandwich liquidity. Configure at deploy, never touch again."
      />

      <Section>
        <PrimitiveDeployBanner
          primitive="AntiSnipeHook · Primitive 02"
          address={CONTRACTS.antiSnipeHook}
          githubPath="https://github.com/lanqi0518-ux/hoodipo/blob/main/rpo/contracts/src/hoodipo/AntiSnipeHook.sol"
        />

        <div className="mt-10 grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 card-soft p-6 lg:p-8">
            <div className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
              Cap curve · linear decay
            </div>
            <div className="text-2xl font-display text-ink-900 mt-1 mb-6">
              How the cap opens over the first 900 blocks
            </div>
            <CapCurve
              startUsdg={1_000}
              endUsdg={100_000}
              capBlocks={900}
            />
            <p className="text-xs text-ink-500 mt-4 leading-relaxed">
              At Robinhood Chain&rsquo;s 2 s block time this is a ~30
              minute cap window. Between minute 30 and eternity the hook
              is a pure no-op — normal V4 fee mechanics apply.
            </p>
          </div>
          <div className="lg:col-span-2 card-soft p-6 lg:p-8">
            <div className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono">
              Exemption
            </div>
            <div className="text-2xl font-display text-ink-900 mt-1 mb-4">
              Why PreMintVault claimants bypass
            </div>
            <div className="flex items-start gap-3 mb-4">
              <Shield className="h-5 w-5 text-forest-500 mt-0.5" />
              <p className="text-sm text-ink-500 leading-relaxed">
                A wallet that already committed USDG during
                subscription and let the vault buy on their behalf
                should not be forced to race MEV searchers again at
                first block. The hook staticcalls the factory to check
                proof-of-subscription — a wallet that only tries to
                announce a decoy vault doesn&rsquo;t qualify because
                its <code className="font-mono text-[10px] bg-paper-100 px-1 py-0.5 rounded">
                  claimed[wallet]
                </code> is never set.
              </p>
            </div>
            <div className="rounded-xl bg-paper-100 border border-line p-4 text-xs font-mono text-ink-900">
              <pre className="whitespace-pre-wrap leading-relaxed">
{`function _isPreMintClaimant(swapper) {
  (ok, data) = factory.staticcall(
    "hasClaimedAnyVault(address)",
    swapper
  );
  return ok && decode(data, bool);
}`}
              </pre>
            </div>
          </div>
        </div>
      </Section>

      <Section className="border-t border-line bg-paper-100">
        <SectionHeader
          eyebrow="Three rails"
          title="What runs the block a new pool initializes."
          description="Every callback below is the hook's implementation — nothing more, nothing less."
        />
        <div className="space-y-4">
          {RAILS.map((r, i) => (
            <div key={r.n} className="grid lg:grid-cols-2 gap-6 items-stretch">
              <div className="card p-8 lg:p-10">
                <div className="text-xs uppercase tracking-[0.14em] text-forest-500 font-mono">
                  Rail {r.n} · {r.tag}
                </div>
                <h3 className="mt-3 font-display text-3xl text-ink-900">
                  {r.title}
                </h3>
                <p className="mt-4 text-ink-500 leading-relaxed">{r.body}</p>
              </div>
              <div className="card p-6 lg:p-8 bg-white overflow-hidden">
                <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-mono mb-4">
                  Solidity
                </div>
                <pre className="text-xs lg:text-sm font-mono text-ink-900 leading-relaxed whitespace-pre overflow-x-auto">
                  <code>{r.code}</code>
                </pre>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="Five invariants"
          title="What the hook guarantees."
          description="Enforced by the constructor + control-flow. No admin knob."
        />
        <div className="grid md:grid-cols-2 gap-4">
          {INVARIANTS.map((line) => (
            <div key={line} className="card p-5 flex items-start gap-3">
              <Check className="h-4 w-4 text-forest-500 mt-1 flex-shrink-0" />
              <span className="text-sm text-ink-900">{line}</span>
            </div>
          ))}
        </div>
      </Section>
    </MarketingShell>
  );
}
