"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function Header() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <header className="border-b border-chain-border px-6 py-4 flex items-center justify-between">
      <Link href="/" className="text-2xl font-bold text-brand tracking-tight">
        HoodIPO
      </Link>
      <nav className="hidden md:flex gap-6 text-sm text-gray-300">
        <Link href="/">IPO Calendar</Link>
        <Link href="/positions">My Positions</Link>
        <Link href="/stake">Stake $IPO</Link>
        <a href="https://docs.hoodipo.xyz" target="_blank" rel="noreferrer">
          Docs
        </a>
      </nav>
      <div>
        {isConnected ? (
          <button
            onClick={() => disconnect()}
            className="btn-outline text-sm"
            title={address}
          >
            {address?.slice(0, 6)}…{address?.slice(-4)}
          </button>
        ) : (
          <button
            onClick={() => connect({ connector: connectors[0] })}
            className="btn-primary text-sm"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
