import { MarketingShell } from "@/components/marketing/MarketingShell";
import { DocLayout, TocItem } from "@/components/docs/DocLayout";
import { Prose } from "@/components/ui/Prose";
import { H2, H3 } from "@/components/ui/H";

export const metadata = {
  title: "TypeScript SDK",
  description:
    "@rpo/sdk — a small, typed, wagmi-compatible library for every write path.",
};

const toc: TocItem[] = [
  { id: "install", label: "Install" },
  { id: "init", label: "Initialisation" },
  { id: "vault", label: "SubscriptionVault" },
  { id: "subscribe", label: "subscribe / cancel / claim", depth: 3 },
  { id: "booster", label: "AllocationBooster" },
  { id: "looper", label: "LeverageLooper" },
  { id: "reads", label: "Convenience reads" },
  { id: "wagmi", label: "wagmi integration" },
  { id: "types", label: "Types" },
];

export default function SdkPage() {
  return (
    <MarketingShell>
      <DocLayout
        meta={{
          eyebrow: "Reference · sdk v1",
          title: "TypeScript SDK",
          subtitle:
            "@rpo/sdk is a ~14KB (gzipped) client that wraps every RPO write path in a strongly-typed, viem-compatible API.",
          updated: "March 2026",
        }}
        toc={toc}
        breadcrumbs={[
          { label: "docs", href: "/docs" },
          { label: "sdk" },
        ]}
      >
        <Prose>
          <H2 id="install">Install</H2>
          <pre>
            <code>{`pnpm add @rpo/sdk viem
# or
npm i @rpo/sdk viem`}</code>
          </pre>
          <p>
            Peer dependency: <code>viem ≥ 2.0</code>. wagmi is optional —
            the SDK exports both a low-level viem-based client and a set of
            wagmi-friendly hooks.
          </p>

          <H2 id="init">Initialisation</H2>
          <pre>
            <code>{`import { createRpo } from "@rpo/sdk";
import { createWalletClient, http, custom } from "viem";
import { robinhoodChain } from "@rpo/sdk/chains";

const wallet = createWalletClient({
  chain: robinhoodChain,
  transport: custom(window.ethereum),
});

const rpo = createRpo({ wallet });`}</code>
          </pre>
          <p>
            The client resolves canonical contract addresses per chain
            automatically. Override with{" "}
            <code>createRpo({"{"} wallet, addresses: {"{"} registry: '0x…', ... {"}"} {"}"})</code>{" "}
            for testnet deployments.
          </p>

          <H2 id="vault">SubscriptionVault</H2>

          <H3 id="subscribe">subscribe / cancel / claim</H3>
          <pre>
            <code>{`// Subscribe $500 USDG to the STRIPE vault
const tx = await rpo.vault("STRIPE").subscribe({
  amount: 500_000000n, // 6-decimal USDG
});
await tx.wait();

// Cancel and refund before fulfillment
await rpo.vault("STRIPE").cancel();

// Claim d-token after fulfillment
const claimTx = await rpo.vault("STRIPE").claim();
const receipt = await claimTx.wait();
console.log("Received", receipt.tokensOut, "dSTRIPE");`}</code>
          </pre>

          <H2 id="booster">AllocationBooster</H2>
          <pre>
            <code>{`// Stake 5,000 $RPO
await rpo.booster.stake({ amount: 5_000n * 10n ** 18n });

// Start 14d cooldown
await rpo.booster.unstake({ amount: 5_000n * 10n ** 18n });

// Get current boost
const boost = await rpo.booster.boostOf("0xabc…");
// -> 1.42 (as JS number)`}</code>
          </pre>

          <H2 id="looper">LeverageLooper</H2>
          <pre>
            <code>{`// Deposit dCORZ as collateral, borrow USDG to 60% LTV,
// and auto-subscribe borrowed USDG to the next open vault.
await rpo.looper.loop({
  collateral: "dCORZ",
  amount: 100n * 10n ** 18n,
  targetLtv: 0.6,
  autoSubscribeTo: "KLARNA",
});`}</code>
          </pre>

          <H2 id="reads">Convenience reads</H2>
          <pre>
            <code>{`const active = await rpo.ipos.active();
const detail = await rpo.ipos.get("STRIPE");
const positions = await rpo.user.positions("0xabc…");
const boost = await rpo.user.boost("0xabc…");
const leaderboard = await rpo.leaderboard.top(100);`}</code>
          </pre>

          <H2 id="wagmi">wagmi integration</H2>
          <pre>
            <code>{`import { useRpoVault, useBoost } from "@rpo/sdk/wagmi";

function SubscribeButton() {
  const { subscribe, isPending } = useRpoVault("STRIPE");
  const { data: boost } = useBoost();

  return (
    <button
      onClick={() => subscribe({ amount: 500_000000n })}
      disabled={isPending}
    >
      Subscribe with {boost}× boost
    </button>
  );
}`}</code>
          </pre>

          <H2 id="types">Types</H2>
          <p>
            All contract structs are re-exported with camelCase field names
            and native bigint amounts. See{" "}
            <a href="https://github.com/lanqi0518-ux/balls/blob/main/packages/sdk/src/types.ts">
              packages/sdk/src/types.ts
            </a>{" "}
            for the canonical definitions.
          </p>
        </Prose>
      </DocLayout>
    </MarketingShell>
  );
}
