"use client";

/**
 * Testnet faucet. Handed out by the Faucet.sol contract deployed as
 * part of DeployTestnet.s.sol — one drip per wallet per 24h.
 *
 * The page is fully rendered even when NEXT_PUBLIC_FAUCET_ADDRESS is
 * still the zero address; in that case, the CTA becomes "coming soon"
 * and the copy explains the go-live plan.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/Button";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { Badge } from "@/components/ui/Badge";
import { PendingDeploymentPanel } from "@/components/app/NetworkStatus";
import { CONTRACTS, activeChain, isDeployed } from "@/lib/chain";
import {
  useFaucetCountdown,
  useRpoBalance,
  useUsdgBalance,
} from "@/lib/onchain/reads";
import { useFaucetDrip } from "@/lib/onchain/writes";
import { RPO_DECIMALS, toNumber, USDG_DECIMALS } from "@/lib/onchain/units";
import { fmtNum, fmtUSD } from "@/lib/format";

const DRIP_USDG = 10_000;
const DRIP_RPO = 25_000;

export default function FaucetPage() {
  const { isConnected } = useAccount();
  const faucetLive = isDeployed(CONTRACTS.faucet);
  const cooldown = useFaucetCountdown();
  const usdg = useUsdgBalance();
  const rpo = useRpoBalance();
  const drip = useFaucetDrip();
  const [nowSec, setNowSec] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNowSec((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = Number(cooldown.data);
  const canDrip = isConnected && faucetLive && remaining <= 0;

  return (
    <div className="min-h-screen bg-paper-100">
      <div className="max-w-3xl mx-auto p-6 lg:p-10">
        <Link
          href="/app"
          className="text-sm text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 mb-8"
        >
          ← Back to app
        </Link>

        <header className="mb-10">
          <div className="eyebrow mb-3">Faucet</div>
          <h1 className="font-display text-4xl lg:text-5xl text-ink-900">
            Get testnet USDG + $RPO.
          </h1>
          <p className="mt-4 text-ink-500 max-w-2xl">
            One-shot deploy of the entire RPO stack — real contracts, real
            wallets, no simulation. Use it to try subscribing, staking,
            claiming, and cancelling end-to-end before mainnet.
          </p>
        </header>

        {!faucetLive ? (
          <PendingDeploymentPanel
            title="Faucet · pending testnet deployment"
            hint="The Faucet contract distributes 10,000 USDG + 25,000 RPO per drip with a 24-hour cooldown. As soon as it's deployed to a testnet (Arbitrum Sepolia recommended) and NEXT_PUBLIC_FAUCET_ADDRESS is set, this page hands out real tokens."
          />
        ) : (
          <div className="card-floating p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-paper-100 border border-line p-5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-mono">
                  Per drip
                </div>
                <div className="mt-2 font-display text-2xl text-ink-900 tabular-nums">
                  {fmtUSD(DRIP_USDG, { compact: true })}
                </div>
                <div className="text-xs text-ink-500 mt-1">USDG</div>
              </div>
              <div className="rounded-xl bg-paper-100 border border-line p-5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-mono">
                  Per drip
                </div>
                <div className="mt-2 font-display text-2xl text-ink-900 tabular-nums">
                  {DRIP_RPO.toLocaleString()}
                </div>
                <div className="text-xs text-ink-500 mt-1">$RPO</div>
              </div>
            </div>

            {isConnected ? (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-xl border border-line p-4">
                    <div className="text-xs text-ink-500">
                      Your USDG balance
                    </div>
                    <div className="font-mono text-lg text-ink-900 mt-1">
                      {fmtUSD(toNumber(usdg.data, USDG_DECIMALS))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-line p-4">
                    <div className="text-xs text-ink-500">
                      Your $RPO balance
                    </div>
                    <div className="font-mono text-lg text-ink-900 mt-1">
                      {fmtNum(toNumber(rpo.data, RPO_DECIMALS), 0)}
                    </div>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={!canDrip || drip.pending}
                  onClick={() =>
                    drip.run({
                      onConfirmed: () => {
                        usdg.refetch();
                        rpo.refetch();
                        cooldown.refetch();
                      },
                    })
                  }
                >
                  {drip.pending
                    ? "Sending drip…"
                    : canDrip
                    ? `Drip ${fmtUSD(DRIP_USDG, {
                        compact: true,
                      })} USDG + ${DRIP_RPO.toLocaleString()} $RPO`
                    : `Next drip in ${fmtHuman(remaining)}`}
                </Button>

                {remaining > 0 && (
                  <div className="text-xs text-ink-500 text-center">
                    Cooldown resets every 24 hours per wallet.
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-ink-500">
                  Connect a wallet on{" "}
                  <span className="font-semibold text-ink-900">
                    {activeChain.name}
                  </span>{" "}
                  to receive a drip.
                </div>
                <ConnectButton
                  size="md"
                  variant="primary"
                  className="w-full [&>div]:w-full [&_button]:w-full [&_button]:justify-center"
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-10 grid md:grid-cols-2 gap-6 text-sm text-ink-500">
          <div className="card p-6">
            <Badge variant="forest">Real contracts</Badge>
            <div className="text-ink-900 font-semibold mt-3 mb-1">
              What runs onchain
            </div>
            <p>
              MockUSDG · MockRPO · AllocationBooster · RialtoAdapter ·
              IPORegistry · AssetDiscovery · Faucet. Everything except
              stablecoin liquidity and the launchpad are real Solidity from
              this repo.
            </p>
          </div>
          <div className="card p-6">
            <Badge>Bring a wallet</Badge>
            <div className="text-ink-900 font-semibold mt-3 mb-1">
              What you can do
            </div>
            <p>
              Drip tokens → stake for boost → open a vault permissionlessly
              on any ERC-20 → subscribe → keeper fulfills → claim your
              Stock Token. The full lifecycle.
            </p>
          </div>
        </div>

        <div className="mt-6 text-xs text-ink-500 leading-relaxed">
          Active chain: <span className="font-mono">{activeChain.name}</span>{" "}
          (id <span className="font-mono">{activeChain.id}</span>). Faucet
          address:{" "}
          <span className="font-mono">
            {faucetLive ? CONTRACTS.faucet : "not configured"}
          </span>
        </div>
      </div>
    </div>
  );
}

function fmtHuman(sec: number): string {
  if (sec <= 0) return "now";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
