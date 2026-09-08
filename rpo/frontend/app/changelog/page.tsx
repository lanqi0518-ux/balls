import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight } from "@/components/ui/Icons";
import { CodeBlock } from "@/components/ui/CodeBlock";

export const metadata = {
  title: "Changelog",
  description: "Every RPO release, with commit hash, chain-id, and migration notes.",
};

type Release = {
  version: string;
  date: string;
  commit: string;
  channel: "mainnet" | "testnet";
  tag: "Feature" | "Fix" | "Security" | "Perf" | "Content";
  title: string;
  body: string;
  bullets?: string[];
  code?: { lang: "solidity" | "bash" | "typescript"; content: string };
};

const RELEASES: Release[] = [
  {
    version: "v1.0.3",
    date: "2026-03-08",
    commit: "4a8c2f9",
    channel: "mainnet",
    tag: "Feature",
    title: "LeverageLooper enters GA",
    body: "6 new Morpho Blue markets for dCORZ, dRDDT, dTSMC-2, dNVDA-B, dSPY, dQQQ. LeverageLooper.loop() is now callable through the app UI at /app/positions.",
    bullets: [
      "New markets deployed with LLTV 77.5% (single-name) / 80% (mid-cap) / 86% (index).",
      "Health-factor warn threshold raised from 1.25 to 1.35 in the UI.",
      "Gelato liquidation-bot backup keeper live.",
    ],
  },
  {
    version: "v1.0.2",
    date: "2026-02-24",
    commit: "b7f31c1",
    channel: "mainnet",
    tag: "Security",
    title: "Bond-slash griefing fix (TOB-2026-01-H)",
    body: "Addresses the sole high-severity finding from the Trail of Bits audit. The IPORegistry.slashBond() codepath is now atomic with the vault fill check.",
    code: {
      lang: "solidity",
      content: `- if (vault.totalSubscribed() < vault.target() / 2) {
-     usdg.safeTransfer(vault, BOND);
+ // atomic status snapshot prevents late fulfill front-running the slash
+ if (vault.status() == Status.Failed) {
+     usdg.safeTransfer(address(vault), BOND);
      emit BondSlashed(ticker, BOND);
  }`,
    },
  },
  {
    version: "v1.0.1",
    date: "2026-02-11",
    commit: "d13a9e0",
    channel: "mainnet",
    tag: "Perf",
    title: "-17% gas on subscribe (subsequent)",
    body: "Packed principalOf and weightOf mappings; hot-slot pattern shaves ~13k gas on the average non-first subscribe.",
    bullets: [
      "subscribe() avg gas: 76,200 → 63,441",
      "cancel() avg gas: 82,100 → 78,833",
      "No storage-layout migration required.",
    ],
  },
  {
    version: "v1.0.0",
    date: "2026-02-03",
    commit: "aa7c810",
    channel: "mainnet",
    tag: "Feature",
    title: "Mainnet launch on Robinhood Chain",
    body: "First permissionless IPO subscription protocol goes live. 5 open vaults: STRIPE, CORZ, RDDT, KLARNA, TSMC-2. Trail of Bits + Spearbit audits published in full.",
    bullets: [
      "IPORegistry, SubscriptionVault, AllocationBooster, RialtoAdapter deployed.",
      "$RPO fair-launched on Pons paired against SPY.",
      "Governor + 48h timelock live. Bug bounty scope expanded to $500k on Immunefi.",
    ],
  },
  {
    version: "v0.9.4",
    date: "2026-01-27",
    commit: "3f9c11e",
    channel: "testnet",
    tag: "Fix",
    title: "Aave receipt-token accounting on partial cancel (Spearbit-M2)",
    body: "Both Spearbit-medium findings, both around Aave supply-index rounding on partial cancels, were fixed in a single PR.",
  },
  {
    version: "v0.9.0",
    date: "2026-01-15",
    commit: "1c72d02",
    channel: "testnet",
    tag: "Feature",
    title: "Public testnet on Sepolia-Orbit",
    body: "First public deployment. 12 open testnet vaults. Faucet at faucet.rpo.xyz.",
  },
];

const TAG_COLORS: Record<Release["tag"], "forest" | "peach" | "default" | "dark"> = {
  Feature: "forest",
  Fix: "default",
  Security: "peach",
  Perf: "forest",
  Content: "default",
};

export default function ChangelogPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Changelog"
        title="Every release, dated and signed."
        description="RPO follows semver strictly. Every release has a signed git tag, a published commit hash, and — for on-chain changes — a matching Etherscan verification. Nothing ships without an entry here."
      />

      <section className="section">
        <div className="container-wide max-w-4xl">
          <div className="space-y-16">
            {RELEASES.map((r) => (
              <div key={r.version} className="grid md:grid-cols-[180px_1fr] gap-6 md:gap-10">
                <div className="md:sticky md:top-24 md:self-start">
                  <div className="text-xs font-mono text-ink-500">
                    {r.date}
                  </div>
                  <div className="font-display text-2xl text-ink-900 mt-1">
                    {r.version}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <Badge variant={TAG_COLORS[r.tag]}>{r.tag}</Badge>
                    <Badge>{r.channel}</Badge>
                  </div>
                  <a
                    href={`https://github.com/lanqi0518-ux/balls/commit/${r.commit}`}
                    className="text-xs text-forest-500 hover:underline font-mono mt-3 inline-flex items-center gap-1"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {r.commit} <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-2xl text-ink-900 mb-3">
                    {r.title}
                  </h3>
                  <p className="text-ink-500 leading-relaxed">{r.body}</p>
                  {r.bullets && (
                    <ul className="mt-4 space-y-2">
                      {r.bullets.map((b, i) => (
                        <li
                          key={i}
                          className="text-sm text-ink-500 pl-4 relative before:content-['·'] before:absolute before:left-0 before:text-forest-500 before:font-bold"
                        >
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.code && (
                    <div className="mt-5">
                      <CodeBlock
                        lang={r.code.lang}
                        code={r.code.content}
                        filename={`diff · ${r.commit}`}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight border-t border-line bg-paper-100">
        <div className="container-wide max-w-3xl text-center">
          <div className="eyebrow mb-4 justify-center">Subscribe</div>
          <p className="text-ink-500 max-w-lg mx-auto mb-6">
            Every release is announced via the RPO newsletter and mirrored
            on the{" "}
            <a
              href="/blog/rss.xml"
              className="text-forest-500 hover:underline"
            >
              RSS feed
            </a>
            .
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
