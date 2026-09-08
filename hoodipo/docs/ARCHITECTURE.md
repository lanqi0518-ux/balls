# HoodIPO Architecture

## Contract responsibility matrix

| Contract | Deploys once? | User-facing? | Keeper-facing? | Holds funds? |
| --- | :---: | :---: | :---: | :---: |
| `IPORegistry` | ✅ | read-only | ✅ (`announceIPO` / `markLaunched` / `activateRefund`) | ❌ |
| `SubscriptionVault` | ❌ (one per IPO, CREATE2) | ✅ (subscribe / claim / cancel / refund) | ❌ (only via Registry) | ✅ (USDG then Stock Token) |
| `AllocationBooster` | ✅ | ✅ (stake / unstake) | ❌ | ✅ ($IPO) |
| `RialtoAdapter` | ✅ | ❌ | ❌ | ❌ (pass-through) |
| `LeverageLooper` | ✅ | ✅ (loop / claim) | ❌ | ❌ (pass-through) |

## End-to-end sequence

```
        USER            REGISTRY         VAULT              RIALTO         STOCK TOKEN
         │                  │              │                  │                │
         │                announceIPO      │                  │                │
   1     │◀────keeper─────▶│─── CREATE2 ─▶│                  │                │
         │                  │              │                  │                │
         │─── subscribe ───────────────────▶│                  │                │
   2     │◀── event Subscribed ────────────│                  │                │
         │                  │              │                  │                │
         │             (subscription window elapses)         │                │
         │                  │              │                  │                │
   3     │◀───keeper detects new dSTRIPE on /rhj/assets       │                │
         │                  │              │                  │                │
         │            markLaunched         │                  │                │
   4     │──────keeper─────▶│──fulfill()──▶│─── buyBestPrice ─▶│                │
         │                  │              │                  │───mint / xfer──▶│
         │                  │              │◀────received─────│                │
         │                  │              │                  │                │
         │─── claim ───────────────────────▶│                  │                │
   5     │◀──── stockToken transfer ───────│                  │                │
         │                                                                     │
         ├─────────────────────────────────────────────────────────────────────┤
         │                                                                     │
         │      Optional path from step 5: user loops via LeverageLooper       │
         │      (Morpho Blue supply + borrow + subscribe next IPO's vault)     │
```

## Deployment order

1. Launch `$IPO` on Pons (out-of-band; produces the token address).
2. `AllocationBooster(ipoToken)`.
3. `RialtoAdapter(owner, rialtoRouter, universalRouter)`.
4. `IPORegistry(owner, keeper, USDG, feeCollector, booster, adapter)`.
5. `LeverageLooper(owner, USDG, morphoBlue)`.
6. Fund keeper EOA with ETH for gas (Robinhood Wallet-linked EOAs may qualify for gas subsidy).
7. Run the keeper (`hoodipo/keeper`); the first tick seeds the "known assets" baseline so pre-existing Stock Tokens don't accidentally trigger a launch.

## Failure modes

| Failure | Mitigation |
| --- | --- |
| Rialto quote unavailable / worse than min | Adapter falls through to Uniswap V3 via Universal Router. |
| Uniswap V3 pool has no liquidity at chosen fee tier | Owner rotates via `setUniPoolFee()`; final fallback path can be extended to 0x RFQ. |
| RH doesn't list the announced ticker in time | After `fulfillmentDeadline`, anyone can call `activateRefund(ticker)` → users get 100% USDG back. |
| Keeper offline | `markLaunched()` can be called by owner too; a backup keeper can be added via `setKeeper()`. |
| Rialto ABI mismatch | The adapter's `try/catch` will fall through to Uniswap; owner rotates `rialtoRouter` via `setRouters()`. |
| Griefing subscribe/cancel loop | Cancel only allowed inside subscription window; funds pulled via `safeTransfer`, no state can be manipulated mid-fulfill (reentrancy-guarded). |
| Registry compromised owner | Owner cannot mint tokens, cannot claim user funds, only can rotate keeper / fee bps within cap. Design intent: put owner behind a Safe multisig with community observers. |

## Security notes

- All external calls flow through `SafeERC20`.
- Fulfill / claim / refund are `nonReentrant`.
- Weights are captured at deposit time (using the boost value in effect then) so late stakers cannot alter early subscribers' allocations.
- CREATE2 salt = `keccak256(ticker)` — a given ticker gets a deterministic vault address, so the frontend can precompute it before the keeper announces.
