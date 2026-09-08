# Deploy Runbook

## 0. Prerequisites

- **Foundry** installed (`curl -L https://foundry.paradigm.xyz | bash && foundryup`).
- **Node 20+** for the keeper & frontend.
- A funded EOA on Robinhood Chain (chain ID `4663`). Bridge ETH via [`bridge.chain.robinhood.com`](https://bridge.chain.robinhood.com) or wait for the 7-day L1 withdrawal window if you're moving in the other direction.
- A `$IPO` token address (launched on Pons v2 with **SPY** as quote asset).
- A Rialto propAMM router address (source from Robinhood ops or reverse-engineer from Robinscan).
- A Morpho Blue deployment on Robinhood Chain (see [morpho.org deployments](https://docs.morpho.org)).

## 1. Deploy contracts

```bash
cd contracts
cp .env.example .env
# fill in every variable — read comments carefully

# dry-run first
forge script script/Deploy.s.sol --rpc-url $RH_MAINNET_RPC

# broadcast
forge script script/Deploy.s.sol --rpc-url $RH_MAINNET_RPC --broadcast --verify
```

Deploy prints four addresses. Persist them into `frontend/lib/chain.ts::DEPLOYMENT` and into the keeper `.env` file.

## 2. Sanity-check deployment

```bash
# read-only calls
cast call $REGISTRY_ADDR "platformFeeBps()(uint16)" --rpc-url $RH_MAINNET_RPC
cast call $BOOSTER_ADDR "MIN_LOCK()(uint256)" --rpc-url $RH_MAINNET_RPC
cast call $ADAPTER_ADDR "defaultUniPoolFee()(uint24)" --rpc-url $RH_MAINNET_RPC
```

## 3. Announce the first IPO

The keeper doesn't announce IPOs automatically — you do that manually (e.g. reading Robinhood's public "Upcoming Stock Tokens" announcements). Pick a ticker Robinhood has publicly said they'll list:

```bash
cast send $REGISTRY_ADDR \
  "announceIPO(string,string,uint256,uint256)" \
  "STRIPE" "Stripe Inc." 259200 345600 \
  --rpc-url $RH_MAINNET_RPC --private-key $DEPLOYER_PK
```

`259200 = 3 days` subscription window, `345600 = 4 days` fulfillment window.

The transaction emits `IPOAnnounced(key, ticker, vault, subscriptionDeadline)`. Grab the vault address from the log; it will also be reachable via `IPORegistry.getIPO("STRIPE")`.

## 4. Start the keeper

```bash
cd keeper
cp .env.example .env
# fill in REGISTRY_ADDRESS + KEEPER_PRIVATE_KEY (the same one you set as keeper on the registry)
npm install
npm run start
```

The keeper polls every 30s. When Robinhood's `/rhj/assets` endpoint starts returning a new asset with `chainId: 4663` whose ticker matches an announced vault, the keeper fires `markLaunched()` and the vault immediately swaps its accumulated USDG through the Rialto adapter.

## 5. Verify user path

- Visit the frontend, connect wallet, subscribe to the announced IPO.
- Advance to the subscription deadline (or wait it out).
- Confirm the keeper fires `markLaunched()` when the Stock Token appears.
- Call `claim()` from a subscribed wallet; confirm you receive the Stock Token.

## 6. Post-launch operations

- Rotate keeper EOA to a Gelato executor for higher availability (`setKeeper()`).
- Move `IPORegistry` owner to a Safe multisig (`transferOwnership()`).
- Route platform fees to a buyback bot that swaps USDG → $IPO on Uniswap V4 and burns.
