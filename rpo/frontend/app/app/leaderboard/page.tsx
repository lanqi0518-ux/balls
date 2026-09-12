"use client";

import { useAccount } from "wagmi";
import { Badge } from "@/components/ui/Badge";
import { fmtUSD, shortAddr } from "@/lib/format";
import {
  useBoost,
} from "@/lib/onchain/reads";
import { useOnchainPositions } from "@/lib/onchain/positions";
import {
  boostToNumber,
  toNumber,
  USDG_DECIMALS,
} from "@/lib/onchain/units";
import { PROTOCOL_LIVE } from "@/lib/chain";

export default function LeaderboardPage() {
  const { address } = useAccount();
  const boost = useBoost();
  const positions = useOnchainPositions();

  const currentBoost = boostToNumber(boost.data);
  const userSubscribed = positions.data.reduce(
    (a, p) => a + toNumber(p.deposits, USDG_DECIMALS),
    0
  );
  const userClaimed = positions.data.filter((p) => p.claimed).length;
  const userFills = positions.data.filter((p) => p.fulfilled).length;

  return (
    <div className="p-5 lg:p-10 max-w-6xl">
      <header className="mb-10">
        <div className="eyebrow mb-3">Leaderboard</div>
        <h1 className="font-display text-4xl lg:text-5xl text-ink-900">
          Who&apos;s subscribing the most.
        </h1>
        <p className="mt-3 text-ink-500 max-w-2xl">
          Ranked by on-chain activity across every SubscriptionVault. Boost
          reflects current staked share. Until the protocol is deployed on
          mainnet, this page only shows the connected wallet&apos;s own
          on-chain reads — no synthetic rankings are displayed.
        </p>
      </header>

      {!PROTOCOL_LIVE && (
        <div className="card p-6 border-l-4 border-peach-500 bg-peach-50/40 mb-8">
          <Badge variant="peach">Pre-launch</Badge>
          <p className="text-sm text-ink-500 mt-3 leading-relaxed">
            RPO is not deployed on mainnet. There is no on-chain
            subscription volume, no boost pool, and therefore no
            leaderboard to compute. Once contracts are live, this page will
            surface a real ranking indexed from the deployed vaults.
          </p>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-[0.14em] text-ink-500 bg-paper-100">
              <th className="text-left p-4 font-normal w-16">#</th>
              <th className="text-left p-4 font-normal">Wallet</th>
              <th className="text-right p-4 font-normal">Subscribed</th>
              <th className="text-right p-4 font-normal">Boost</th>
              <th className="text-right p-4 font-normal">Fills</th>
              <th className="text-right p-4 font-normal">Claimed</th>
            </tr>
          </thead>
          <tbody>
            {address ? (
              <tr className="bg-forest-50 border-t-2 border-forest-500">
                <td className="p-4 text-forest-500 font-mono font-bold">1</td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-forest-500 to-forest-700" />
                    <div>
                      <div className="text-ink-900 font-medium">You</div>
                      <div className="text-xs text-ink-500 font-mono">
                        {shortAddr(address)}
                      </div>
                    </div>
                    <Badge variant="forest" dot>
                      YOU
                    </Badge>
                  </div>
                </td>
                <td className="p-4 text-right font-mono text-ink-900 tabular-nums">
                  {fmtUSD(userSubscribed, { compact: true })}
                </td>
                <td className="p-4 text-right font-mono text-ink-900 tabular-nums">
                  {currentBoost.toFixed(2)}×
                </td>
                <td className="p-4 text-right font-mono text-ink-500 tabular-nums">
                  {userFills}
                </td>
                <td className="p-4 text-right font-mono text-ink-500 tabular-nums">
                  {userClaimed}
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={6} className="p-12 text-center text-ink-500 text-sm">
                  Connect a wallet to see your on-chain position.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-xs text-ink-500 text-center">
        Leaderboard shown here is derived directly from on-chain reads.
        No off-chain seed data is displayed.
      </div>
    </div>
  );
}
