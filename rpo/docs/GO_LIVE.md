# Go-live playbook

The `/app` UI is fully wired to real Solidity contracts through wagmi. It
reads every balance, stake, and subscription directly from onchain, and
every write button issues a real `writeContract` call. The moment the
addresses below are set, the whole product activates — **no rebuild
required**.

This document is the exact sequence of steps to flip that switch.

## 0. Prerequisites

- Foundry (`forge`, `cast`) installed.
- A funded deployer wallet with a bit of gas on the target chain.
- `PRIVATE_KEY` and (optionally) `FEE_COLLECTOR`, `KEEPER` env vars.
- The frontend deployed somewhere with the ability to set env vars
  (Vercel / Fly / Netlify / etc).

## 1. Deploy the entire stack in one shot

The `DeployTestnet.s.sol` script deploys every contract, wires them
together, mints the deployer 1M USDG + 1M RPO, and prints an
`.env.local`-ready block.

```bash
cd rpo/contracts

forge script script/DeployTestnet.s.sol \
  --rpc-url $RPC_URL \
  --broadcast --slow --legacy \
  -vvv
```

Recommended target for pre-mainnet dry-runs: **Arbitrum Sepolia
(chain 421614)** — same Arbitrum Orbit architecture as Robinhood Chain.

The last block of the console output looks like this:

```
--- Paste into frontend/.env.local ---
NEXT_PUBLIC_CHAIN_ID= 421614
NEXT_PUBLIC_USDG_ADDRESS= 0x...
NEXT_PUBLIC_RPO_ADDRESS= 0x...
NEXT_PUBLIC_FAUCET_ADDRESS= 0x...
NEXT_PUBLIC_BOOSTER_ADDRESS= 0x...
NEXT_PUBLIC_REGISTRY_ADDRESS= 0x...
NEXT_PUBLIC_DISCOVERY_ADDRESS= 0x...
```

## 2. Point the frontend at those addresses

Copy that block into `rpo/frontend/.env.local` (local dev) or set the
same vars in the hosting provider's env panel (production).

Restart / redeploy the frontend. That's it — every screen switches
from "pending deployment" to "live", the /faucet page hands out real
tokens, and the /app/ipo/[ticker] pages let anyone subscribe on-chain.

## 3. Verify manually

1. Visit `/faucet`, connect wallet, click "Drip". A real tx should
   fire — check the tx hash on the block explorer.
2. Visit `/app/stake`, stake some $RPO. Wallet balance should drop,
   staked balance should go up, boost multiplier appears.
3. Open a permissionless vault: call
   `AssetDiscovery.openAftermarket(<any ERC-20>)` from `cast` to
   spawn a real SubscriptionVault. The `/app` page picks it up
   automatically from `IPORegistry.getActiveIPOs()` (once the keeper
   announces it).
4. Subscribe from the UI. Cancel from the UI. Both should fire real
   txs and update balances immediately.

## 4. Mainnet flip

Repeat the same steps on Robinhood Chain (chain 4663) with the
production-grade contracts (real USDG at
`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, real $RPO once launched
on Pons, etc.). The frontend code stays byte-for-byte identical —
only the env vars change.

## 5. What is NOT in this playbook

- **Launching $RPO on Pons.** That's a separate one-click Pons flow,
  independent of the contracts here.
- **Bridging USDG from other chains.** The UI shows the USDC-Base /
  USDC-Arb / ETH-Mainnet options as "coming soon" until the LiFi
  widget is turned on.
- **Keeper operation.** See `rpo/keeper/README.md` — the keeper scans
  RHJ, Pons, and Uniswap for fresh tickers and calls
  `AssetDiscovery.open*()` on them. Run it as a systemd service after
  the contracts are deployed.

## Contract addresses (mainnet, TBD)

Once mainnet is live these will be committed to
`rpo/contracts/addresses.robinhood.json` and re-exported through
`rpo/frontend/lib/addresses.ts`. Until then the `.env.local` mechanism
above is the single source of truth.
