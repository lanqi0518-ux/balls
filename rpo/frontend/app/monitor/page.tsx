import type { Metadata } from "next";
import { MarketingShell, PageHero } from "@/components/marketing/MarketingShell";
import { Section, SectionHeader } from "@/components/ui/Section";
import { fetchAssets, fetchCorporateActions } from "@/lib/rhApi";
import { STOCK_TOKENS } from "@/lib/robinhood/tokens";

export const metadata: Metadata = {
  title: "Monitor · HOODIPO keeper feed",
  description:
    "The exact snapshot HOODIPO's keeper bot sees: new RHJ Reg-S mints, uiMultiplier deltas, and corporate-action pipeline — reachable at /api/monitor as JSON.",
};

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function MonitorPage() {
  const [assets, corp] = await Promise.all([
    fetchAssets().catch(() => null),
    fetchCorporateActions().catch(() => null),
  ]);

  const registryTickers = new Set(
    STOCK_TOKENS.map((t) => t.ticker.toUpperCase())
  );
  const newMints = (assets ?? []).filter(
    (a) =>
      a.status === "ASSET_STATUS_ACTIVE" &&
      !registryTickers.has(a.tokenSymbol.toUpperCase()) &&
      a.deployments.some((d) => d.chainId === 4663)
  );
  const deltas = (assets ?? [])
    .map((a) => {
      const local = STOCK_TOKENS.find(
        (t) => t.ticker.toUpperCase() === a.tokenSymbol.toUpperCase()
      );
      if (!local) return null;
      const live = Number(a.currentMultiplier);
      const baked = local.uiMultiplier ?? 1;
      if (!Number.isFinite(live) || live <= 0) return null;
      const diff = Math.abs(live - baked);
      const bps = Math.round((diff * 10_000) / baked);
      if (bps === 0) return null;
      return { ticker: local.ticker, live, baked, bps };
    })
    .filter(Boolean) as { ticker: string; live: number; baked: number; bps: number }[];

  return (
    <MarketingShell>
      <PageHero
        eyebrow="Monitor"
        title={
          <>
            The <span className="italic text-forest-500">keeper&rsquo;s eye</span> on
            Robinhood&rsquo;s Reg-S catalog.
          </>
        }
        description="Live cross-reference of Robinhood's public /rhj/assets registry against the 192 tokens HOODIPO has baked into its registry. Any row in the 'new mints' table below is a candidate for a PreMintVault.fulfill() call; any row in 'uiMultiplier deltas' is a CorpActionsRegistry.execute() candidate. The exact same JSON lives at /api/monitor for programmatic keepers."
      />

      <Section>
        <div className="grid md:grid-cols-4 gap-4">
          <Stat label="RH assets total" value={assets ? String(assets.length) : "—"} />
          <Stat label="Registered locally" value={String(STOCK_TOKENS.length)} />
          <Stat label="New mints (RHJ)" value={String(newMints.length)} />
          <Stat label="uiMultiplier deltas" value={String(deltas.length)} />
        </div>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="Candidate fulfill()"
          title="Newly minted tickers not yet in the local registry"
          description="If any row appears here, an announce()'d PreMintVault for that ticker can be fulfilled right now."
        />
        {newMints.length === 0 ? (
          <div className="card-soft p-6 text-sm text-ink-500">
            No new mints since the local registry was last built. The
            keeper has nothing to do this poll — refresh in 60s.
          </div>
        ) : (
          <div className="card-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-100">
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
                    Ticker
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
                    Name
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
                    Contract (RH Chain)
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
                    uiMultiplier
                  </th>
                </tr>
              </thead>
              <tbody>
                {newMints.map((m) => {
                  const rh = m.deployments.find((d) => d.chainId === 4663);
                  return (
                    <tr key={m.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-4 font-mono text-ink-900 font-semibold">
                        {m.tokenSymbol}
                      </td>
                      <td className="px-5 py-4 text-ink-500">{m.tokenName}</td>
                      <td className="px-5 py-4 font-mono text-xs text-ink-900">
                        {rh ? (
                          <a
                            href={`https://robinscan.com/address/${rh.contractAddress}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {rh.contractAddress.slice(0, 8)}…{rh.contractAddress.slice(-6)}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-ink-900">
                        {m.currentMultiplier}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section>
        <SectionHeader
          eyebrow="Candidate CorpActionsRegistry.execute()"
          title="uiMultiplier deltas since registry rebuild"
          description="Every row is a moved oracle: registered strategies with a matching (token, minDeltaBps) can be executed right now for a keeper bounty."
        />
        {deltas.length === 0 ? (
          <div className="card-soft p-6 text-sm text-ink-500">
            No divergence between the RH assets feed and the local
            registry.
          </div>
        ) : (
          <div className="card-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-100">
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
                    Ticker
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
                    Registry
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
                    Live
                  </th>
                  <th className="text-right px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
                    Delta
                  </th>
                </tr>
              </thead>
              <tbody>
                {deltas.map((d) => (
                  <tr key={d.ticker} className="border-b border-line last:border-0">
                    <td className="px-5 py-4 font-mono text-ink-900 font-semibold">
                      d{d.ticker}
                    </td>
                    <td className="px-5 py-4 font-mono text-ink-500">
                      {d.baked.toFixed(6)}
                    </td>
                    <td className="px-5 py-4 font-mono text-ink-900">
                      {d.live.toFixed(6)}
                    </td>
                    <td className="px-5 py-4 font-mono text-right text-forest-500 font-semibold">
                      {d.bps} bps
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section>
        <SectionHeader
          eyebrow="Corporate actions pipeline"
          title="Pending / recent RHJ corporate actions"
          description="Raw feed from https://api.robinhood.com/rhj/corporate-actions — the same list the keeper cross-references against arm()'d strategies."
        />
        {!corp || corp.length === 0 ? (
          <div className="card-soft p-6 text-sm text-ink-500">
            No pending corporate actions reported by RHJ.
          </div>
        ) : (
          <div className="card-soft p-6 space-y-2 max-h-[500px] overflow-y-auto text-xs font-mono text-ink-900">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(corp.slice(0, 20), null, 2)}
            </pre>
          </div>
        )}
      </Section>

      <Section>
        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.18em] text-ink-500 font-mono mb-3">
            Programmatic access
          </div>
          <div className="text-sm text-ink-900 mb-3">
            The same snapshot is available as JSON for keepers and bots:
          </div>
          <div className="rounded-xl bg-paper-100 border border-line p-4 text-xs font-mono text-ink-900 overflow-x-auto">
            <pre>{`GET /api/monitor
→ {
    ok: true,
    counts: { rhAssets, registered, newListings, uiMultiplierDeltas },
    rhChain: { chainId: 4663, latestBlock },
    newListings: [...],        // fulfill() candidates
    uiMultiplierDeltas: [...], // execute() candidates
    corpActions: [...]         // raw RHJ pipeline
  }`}</pre>
          </div>
        </div>
      </Section>
    </MarketingShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500 font-mono">
        {label}
      </div>
      <div className="mt-2 text-3xl font-mono text-ink-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}
