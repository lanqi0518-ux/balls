import { Section, SectionHeader } from "@/components/ui/Section";
import { LinkButton } from "@/components/ui/Button";
import { ArrowRight } from "@/components/ui/Icons";
import Link from "next/link";

/**
 * The 5 HOODIPO primitives — one card per contract, each linking to
 * both the deep-dive product page and the on-chain contract source.
 */

type Pillar = {
  n: string;
  glyph: string;
  contract: string;
  contractPath: string;
  title: string;
  problem: string;
  primitive: string;
  href: string;
  cta: string;
};

const PILLARS: Pillar[] = [
  {
    n: "01",
    glyph: "PMV",
    contract: "PreMintVault + PreMintFactory",
    contractPath:
      "https://github.com/lanqi0518-ux/balls/blob/main/rpo/contracts/src/hoodipo/PreMintVault.sol",
    title: "Pre-mint subscription vaults",
    problem:
      "Robinhood mints new Stock Tokens with zero pre-announcement. By the time /rhj/assets updates, the pool has already opened and every retail wallet fights MEV bots for the first block.",
    primitive:
      "Anyone calls announce(ticker) to permissionlessly deploy a CREATE2 vault. Deposits sit in USDG. The block Robinhood mints the token, any keeper submits the RHJ-signed attestation → the vault swaps through UniversalRouter at a Chainlink-bounded slippage floor and earns a bounty from the pot.",
    href: "/vault",
    cta: "Open a pre-mint vault",
  },
  {
    n: "02",
    glyph: "ASH",
    contract: "AntiSnipeHook (V4)",
    contractPath:
      "https://github.com/lanqi0518-ux/balls/blob/main/rpo/contracts/src/hoodipo/AntiSnipeHook.sol",
    title: "Anti-MEV fair launch V4 hook",
    problem:
      "Every fresh RH-Chain pool is a snipers' playground: within one block a searcher drains 60% of the liquidity into their own wallet, sells it in-block to retail, and pockets the JIT sandwich.",
    primitive:
      "Uniswap V4 hook enforces a time-decaying per-swap USDG cap during the first ~30 min, exempts wallets holding a PreMintVault receipt, and charges a JIT-LP tax on LPs that mint + burn inside an 8-block window. Every rail is on-chain; no admin can whitelist a sniper.",
    href: "/launch",
    cta: "Watch a fair launch",
  },
  {
    n: "03",
    glyph: "CAR",
    contract: "CorpActionsRegistry",
    contractPath:
      "https://github.com/lanqi0518-ux/balls/blob/main/rpo/contracts/src/hoodipo/CorpActionsRegistry.sol",
    title: "Programmable corporate actions",
    problem:
      "Every Robinhood Stock Token exposes uiMultiplier() (ERC-8056) for dividends, splits, and distributions. Today nobody reacts to it — holders eat the price shock passively.",
    primitive:
      "Arm a strategy on any (token, delta_bps) tuple. When uiMultiplier() moves past your threshold, any keeper executes the pre-authorised swap for you (TOP_UP after dividends, REBALANCE_TO_USDG on distributions) and takes a keeper bounty. Composable primitive that any DeFi vault can build on.",
    href: "/strategies",
    cta: "Compose a strategy",
  },
  {
    n: "04",
    glyph: "PPM",
    contract: "PhysicalPredictionMarket",
    contractPath:
      "https://github.com/lanqi0518-ux/balls/blob/main/rpo/contracts/src/hoodipo/PhysicalPredictionMarket.sol",
    title: "Physical-delivery IPO markets",
    problem:
      'Polymarket and Kalshi let you bet USDC on "Will Stripe IPO in 2026?" — but the settlement is cash. You can\'t actually walk away with the equity if you were right.',
    primitive:
      "Binary market on 'Will Robinhood mint d-TICKER before deadline?'. YES-side is settled physically: the resolver routes the pot through UniversalRouter into real d-TICKER, which YES holders claim pro-rata. NO holders reclaim USDG 1:1. No house edge beyond a 2% platform fee.",
    href: "/predict",
    cta: "Open the predict market",
  },
  {
    n: "05",
    glyph: "LHV",
    contract: "LockupHedgeVault",
    contractPath:
      "https://github.com/lanqi0518-ux/balls/blob/main/rpo/contracts/src/hoodipo/LockupHedgeVault.sol",
    title: "Lockup event hedging",
    problem:
      "Reg-S retail buyers of recent IPOs — CRCL, FIG, CRWV, BULL — hit the same 180-day lockup cliff as insiders but have zero access to hedging. On T-180 they watch insider unlock volume dump the pool.",
    primitive:
      "Register a d-TICKER position, arm a Chainlink-strike stop-loss (with per-ticker lockup expiry stored on-chain for composability). Any keeper triggers the swap the moment the feed prints below strike, earning a bounty. Owner can disarm and withdraw at any time — no counter-party risk.",
    href: "/hedge",
    cta: "Hedge a lockup",
  },
];

export function FivePillars() {
  return (
    <Section
      id="pillars"
      className="bg-gradient-to-b from-white to-paper-100 border-y border-line"
    >
      <SectionHeader
        eyebrow="The 5 HOODIPO primitives"
        title={
          <>
            Five contracts. One{" "}
            <span className="italic">primary-market layer</span> for
            Robinhood Chain.
          </>
        }
        description="Nothing here exists elsewhere on Robinhood Chain today. Each primitive is a small, audited-shape Solidity contract with no admin key and no upgrade path — the moment it's deployed, it is permanent public infrastructure."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {PILLARS.map((p, i) => (
          <div
            key={p.n}
            className="card-soft p-8 lg:p-10 relative overflow-hidden hover:shadow-card transition-shadow duration-300 group animate-fade-in-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-ink-500 font-mono">
                  Primitive {p.n}
                </div>
                <div className="mt-1 font-mono text-xs text-ink-500 tracking-tight">
                  {p.contract}
                </div>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-ink-900 text-white font-bold text-xs flex items-center justify-center shadow-3d">
                {p.glyph}
              </div>
            </div>

            <h3 className="font-display text-2xl lg:text-3xl text-ink-900 leading-tight mb-4">
              {p.title}
            </h3>

            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono mb-1">
                Gap
              </div>
              <p className="text-sm text-ink-500 leading-relaxed">{p.problem}</p>
            </div>

            <div className="mb-6">
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono mb-1">
                Primitive
              </div>
              <p className="text-sm text-ink-900 leading-relaxed">
                {p.primitive}
              </p>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-line">
              <Link
                href={p.href}
                className="text-sm font-semibold text-ink-900 inline-flex items-center gap-1 group-hover:gap-2 transition-all hover:underline"
              >
                {p.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={p.contractPath}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-xs text-ink-500 hover:text-ink-900 font-mono"
              >
                View .sol →
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 flex justify-center">
        <LinkButton
          href="/how-it-works"
          variant="outline"
          size="md"
          trailingIcon={<ArrowRight className="h-4 w-4" />}
        >
          Read how the 5 primitives compose
        </LinkButton>
      </div>
    </Section>
  );
}
