# HoodIPO

**Subscribe to real IPOs on-chain. No broker. No KYC. In 20 seconds.**

HoodIPO is a permissionless launchpad on [Robinhood Chain](https://docs.robinhood.com/chain/) (Arbitrum Orbit L2, chain ID `4663`) that lets any global user pre-subscribe to Robinhood's tokenized US-equity IPOs. When Robinhood mints a new Stock Token on-chain, the corresponding vault auto-buys through the [Rialto propAMM](https://docs.robinhood.com/chain/building-with-stock-tokens/) — closer to primary-market pricing than sniping Uniswap — and distributes the position pro-rata to subscribers.

> **Nothing in this repo is legal advice.** Robinhood Stock Tokens are Reg-S debt securities issued by Robinhood Assets (Jersey) Limited and are not offered or sold to U.S. persons, Canadians, U.K., Swiss, or U.A.E. residents. This code is a technical demonstration; deploying it in production is your own decision and responsibility.

---

## Why "IPO on-chain" is actually possible here

Robinhood already carries the entire securities-compliance stack on your behalf:

- **Jersey issuer & prospectus** — RHJ handles Reg-S, KYB'd Authorized Participants, custody of the underlying US shares.
- **ERC-8056 wrapper** — each Stock Token exposes `uiMultiplier()`, `balanceOfUI()`, and emits `UIMultiplierUpdated` for corporate actions. Dividends & splits are programmatic.
- **Chainlink total-return feeds** — one per token; price already includes the multiplier.
- **Rialto propAMM + Uniswap V3 + 0x RFQ + Lighter orderbook** — a full liquidity stack from day one.
- **Morpho Blue** — Stock Tokens are eligible collateral, so leveraged loop strategies are trivial.

The gap: no first-class "primary-market access" UI or contract for the global user who doesn't have a Robinhood account. HoodIPO fills that gap by turning **"Robinhood mints a new Stock Token"** into **"user pre-subscribes → gets pro-rata allocation at the earliest possible on-chain price"**.

---

## Architecture

```
Frontend (Next.js + wagmi + LiFi widget)
        │
        ↓ signs tx
┌────────────────────────────────────────────────────────────────┐
│                Robinhood Chain (4663)                          │
│  ┌───────────────┐    ┌─────────────────────┐                  │
│  │ IPORegistry   │◀──▶│ SubscriptionVault(N)│                  │
│  │ (deploys+     │    │ (per-IPO USDG pool) │                  │
│  │  triggers)    │    └──────────┬──────────┘                  │
│  └──────┬────────┘               │                             │
│         │                        ↓                             │
│  ┌──────┴────────┐    ┌─────────────────────┐                  │
│  │ AllocationBst │    │   RialtoAdapter     │                  │
│  │ ($IPO stake)  │    │ (Rialto → UniV3     │                  │
│  └───────────────┘    │  → 0x RFQ fallback) │                  │
│                       └──────────┬──────────┘                  │
│  ┌───────────────┐               │                             │
│  │LeverageLooper │──── Morpho Blue                             │
│  └───────────────┘                                             │
└────────────────────────────────────────────────────────────────┘
        ↑
        │ markLaunched(ticker, stockToken)
┌────────────────────────────────────────────────────────────────┐
│  Off-chain Keeper (Node.js + viem)                             │
│  Polls https://api.robinhood.com/rhj/assets every 30s          │
│  Diffs previous snapshot → detects new Stock Tokens →          │
│  calls IPORegistry.markLaunched() atomically                   │
└────────────────────────────────────────────────────────────────┘
```

---

## Repo layout

```
hoodipo/
├── contracts/           Foundry project (5 core contracts + tests)
│   ├── src/
│   │   ├── IPORegistry.sol
│   │   ├── SubscriptionVault.sol
│   │   ├── AllocationBooster.sol
│   │   ├── LeverageLooper.sol
│   │   ├── adapters/RialtoAdapter.sol
│   │   ├── interfaces/{IRialtoRouter, IUniversalRouter, IChainlinkAggregator, IERC8056, IMorphoBlue}.sol
│   │   └── mocks/{MockERC20, MockRialtoRouter}.sol
│   ├── test/HoodIPO.t.sol        12 unit tests, all passing
│   ├── script/Deploy.s.sol       Foundry deploy script
│   ├── addresses.robinhood.json  Canonical addresses (USDG, WETH, UniversalRouter, feeds)
│   ├── foundry.toml
│   └── .env.example
├── frontend/            Next.js 14 (App Router) + wagmi + Tailwind
│   ├── app/
│   │   ├── page.tsx              IPO calendar (homepage)
│   │   ├── ipo/[ticker]/page.tsx One-click subscribe
│   │   ├── positions/page.tsx    My positions
│   │   └── stake/page.tsx        Stake $IPO
│   ├── components/               Header, IPOCard
│   └── lib/                      wagmi config, ABIs, chain def, RH API client
└── keeper/              Node.js polling bot
    ├── src/
    │   ├── index.ts              main loop
    │   ├── rhApi.ts              /rhj/assets diff detector
    │   └── registry.ts           viem client that calls markLaunched()
    ├── package.json
    └── .env.example
```

---

## Test status

```
$ cd contracts && forge test -vv

Ran 12 tests for test/HoodIPO.t.sol:HoodIPOTest
[PASS] test_announceIPO_deploysVault
[PASS] test_announceIPO_onlyKeeper
[PASS] test_boosterCurve_capsAt3x
[PASS] test_boosterCurve_nonStakerIs1x
[PASS] test_booster_stakeLockAndUnstake
[PASS] test_cancel_returnsFunds
[PASS] test_doubleClaim_reverts
[PASS] test_fulfillAndClaim_proportionalAllocation
[PASS] test_refund_afterFulfillmentDeadline
[PASS] test_subscribe_addsDepositAndWeight
[PASS] test_subscribe_afterDeadline_reverts
[PASS] test_subscribe_appliesBoost

Suite result: ok. 12 passed; 0 failed
```

---

## Quick start (local dev)

### Contracts

```bash
cd contracts
forge install
forge test -vv                    # 12 tests should pass
forge build --sizes               # confirm nothing exceeds the 24kB limit

# deploy (fill in .env first)
cp .env.example .env
forge script script/Deploy.s.sol --rpc-url $RH_MAINNET_RPC --broadcast
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# open http://localhost:3000
```

### Keeper

```bash
cd keeper
npm install
cp .env.example .env              # fill in REGISTRY_ADDRESS + KEEPER_PRIVATE_KEY
npm run dev                       # tsx watches src/index.ts
```

---

## $IPO token launch on Pons

$IPO is designed to launch on [Pons v2](https://docs.ponsfamily.com/v2) — Robinhood Chain's leading launchpad — with **SPY as quote asset** for the unique "priced against the S&P 500" narrative.

| Parameter | Value |
| --- | --- |
| Supply | `1,000,000,000` (Pons default) |
| Quote asset | **SPY** (Robinhood Stock Token) |
| Snipe tax | Pons default: 99% → 0% over 5 seconds |
| Creator tax | 5% |
| Graduation | Uniswap V4 pool, liquidity permanently locked |
| Utility | Boost IPO allocation up to 3x via AllocationBooster |

80% of platform fees are auto-routed to open-market $IPO buybacks & burns, creating a deflationary flywheel tied to IPO subscription volume.

---

## User flow (target UX)

1. Land on `hoodipo.xyz`.
2. **Connect wallet** (MetaMask, Robinhood Wallet, or Privy social login).
3. See upcoming IPOs (data source: `https://api.robinhood.com/rhj/assets` + IPORegistry).
4. Click **Subscribe** → enter amount → choose pay token (LiFi bridges from any chain).
5. Confirm transaction (Robinhood Wallet users get gas subsidized until 2026-09-29).
6. Wait — Vault deposits earn Morpho Blue USDG yield during the subscription window.
7. Once Robinhood mints the Stock Token on-chain, the keeper triggers `markLaunched()`, the vault swaps through Rialto propAMM, and you receive a `Fulfilled` event notification.
8. `claim()` to receive your Stock Tokens, or `loopIntoNextIPO()` to leverage into the next one via Morpho Blue.

---

## What is NOT included yet

This scaffold is intentionally scoped to the minimum-viable primitives. Notable follow-ups:

- **Rialto ABI** — `RialtoAdapter` currently uses an inferred RFQ interface (`IRialtoRouter`). Verify against the deployed contract before mainnet.
- **Morpho Blue market params** — `LeverageLooper` accepts caller-supplied market params; production should read them from a curated whitelist.
- **Subgraph** — indexing per-vault activity for portfolio views is left to production.
- **Privy / social login** — wired at the config level but the visual flow needs polish.
- **LiFi cross-chain widget** — dependency listed in `package.json`; integration is a follow-up.
- **DAO governance** — `$IPO` timelock + governor stubs are not scaffolded.
- **Audit** — no external review. Do not deploy real funds without one.

---

## References

- Robinhood Chain overview: <https://docs.robinhood.com/chain/>
- Building with Stock Tokens: <https://docs.robinhood.com/chain/building-with-stock-tokens/>
- Stock Token APIs: <https://docs.robinhood.com/chain/stock-token-apis/>
- ERC-8056 spec: <https://docs.robinhood.com/chain/building-with-stock-tokens/#events>
- Pons v2 launchpad: <https://docs.ponsfamily.com/v2>
- `kinexbtdev/rh-stock-token-kit`: <https://github.com/kinexbtdev/rh-stock-token-kit>
- `kinexbtdev/rh-chain-cookbook`: <https://github.com/kinexbtdev/rh-chain-cookbook>

---

## License

MIT. See `LICENSE`.
