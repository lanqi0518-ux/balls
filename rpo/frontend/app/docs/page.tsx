import { Metadata } from "next";
import Link from "next/link";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ArrowUpRight, Book, Layers, Bolt } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "Docs",
  description: "Technical documentation for developers and integrators.",
};

const GUIDES = [
  {
    Icon: Bolt,
    title: "Quickstart",
    body: "Deploy a local fork and subscribe your first vault in under 10 minutes.",
    href: "/docs#quickstart",
  },
  {
    Icon: Layers,
    title: "Contract reference",
    body: "Registry, Vault, Booster, Adapter, Looper — signatures, invariants, and events.",
    href: "/docs#contracts",
  },
  {
    Icon: Book,
    title: "Integrator guide",
    body: "Embed the SubscriptionVault widget or read /rhj/assets via our TypeScript SDK.",
    href: "/docs#integrator",
  },
];

const CONTRACTS = [
  { name: "IPORegistry", addr: "0x0000…0000", note: "Announces and deploys per-IPO vaults." },
  { name: "SubscriptionVault", addr: "CREATE2 per ticker", note: "One instance per IPO. Custody + allocation." },
  { name: "AllocationBooster", addr: "0x0000…0000", note: "$RPO staking, boost math." },
  { name: "RialtoAdapter", addr: "0x0000…0000", note: "Router: Rialto → Uni V3 → 0x RFQ." },
  { name: "LeverageLooper", addr: "0x0000…0000", note: "Morpho collateral + auto re-subscribe." },
];

export default function DocsPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Documentation"
        title={
          <>
            Everything a developer needs to{" "}
            <span className="italic text-forest-500">integrate</span> RPO.
          </>
        }
        description="Reference ABIs, deployment addresses, TypeScript helpers, and integration recipes. Full markdown source in the repo — this page is the canonical hub."
      />

      <Section>
        <div className="grid md:grid-cols-3 gap-4">
          {GUIDES.map(({ Icon, title, body, href }) => (
            <Link
              key={title}
              href={href}
              className="card-hover p-8 flex flex-col gap-4 group"
            >
              <div className="h-10 w-10 rounded-lg bg-forest-50 text-forest-500 flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-2xl text-fg">{title}</h3>
              <p className="text-sm text-fg-muted leading-relaxed flex-1">
                {body}
              </p>
              <div className="text-sm text-forest-500 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                Read <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <Section id="quickstart" className="border-t border-line bg-paper-100">
        <SectionHeader eyebrow="Quickstart" title="Deploy locally in 10 minutes." />
        <div className="card p-6 lg:p-8 bg-paper-100">
          <pre className="text-xs lg:text-sm font-mono text-fg leading-relaxed whitespace-pre overflow-x-auto">
{`# Clone
git clone https://github.com/lanqi0518-ux/balls.git rpo
cd rpo/contracts

# Install Foundry deps
forge install foundry-rs/forge-std --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# Test
forge test -vv

# Deploy to Robinhood Chain (needs env)
cp .env.example .env  # fill in PRIVATE_KEY, RH_CHAIN_RPC, RPO_TOKEN, ...
forge script script/Deploy.s.sol \\
  --broadcast --rpc-url $RH_CHAIN_RPC --verify`}
          </pre>
        </div>
      </Section>

      <Section id="contracts">
        <SectionHeader
          eyebrow="Contracts"
          title="Deployed addresses."
          description="Verify each address against the audit report before integrating."
        />
        <div className="card divide-y divide-line overflow-hidden">
          {CONTRACTS.map((c) => (
            <div
              key={c.name}
              className="p-6 flex items-center justify-between gap-6 hover:bg-paper-100 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-fg font-semibold">{c.name}</div>
                <div className="text-xs text-fg-muted mt-1">{c.note}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="font-mono text-xs text-fg-muted">
                  {c.addr}
                </span>
                <Badge>Mainnet</Badge>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="integrator" className="border-t border-line">
        <SectionHeader
          eyebrow="Integrator"
          title="SDK-level snippet"
          description="Read the current IPO calendar directly from the registry."
        />
        <Container variant="copy" className="!px-0">
          <div className="card p-6 lg:p-8 bg-paper-100">
            <pre className="text-xs lg:text-sm font-mono text-fg leading-relaxed whitespace-pre overflow-x-auto">
{`import { createPublicClient, http } from "viem";
import { robinhoodChain } from "@rpo/sdk/chain";
import { registryAbi, registryAddress } from "@rpo/sdk/abi";

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(),
});

const ipos = await client.readContract({
  address: registryAddress,
  abi: registryAbi,
  functionName: "getActiveIPOs",
});

console.log(ipos);
// [{ ticker: "STRIPE", vault: 0x…, subscriptionDeadline: … }, …]`}
            </pre>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton
              href="https://github.com/lanqi0518-ux/balls"
              external
              variant="outline"
              size="md"
              trailingIcon={<ArrowUpRight className="h-4 w-4" />}
            >
              GitHub repo
            </LinkButton>
            <LinkButton
              href="/security"
              variant="ghost"
              size="md"
            >
              Security & audits
            </LinkButton>
          </div>
        </Container>
      </Section>
    </MarketingShell>
  );
}
