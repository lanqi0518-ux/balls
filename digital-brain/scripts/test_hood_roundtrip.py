"""One-shot Robinhood Chain executor smoke test.

Buys the hard-cap-limited amount of PONS with real ETH, verifies the tx
lands, then sells 100% of the position back to WETH. Prints tx hashes.

Run inside the Fly container so it has access to BRAIN_HOOD_PRIVKEY.
"""
import asyncio
import os
import sys
import time

sys.path.insert(0, "/app")

from backend.robinhood_executor import build_from_env, HoodLimits  # noqa: E402


PONS_ADDR = "0x39dBED3a2bd333467115dE45665cC57F813C4571"
PONS_SYMBOL = "PONS"
PONS_LIQ_USD = 6_670_000.0
BUY_ETH = 0.0005
BUY_CONFIDENCE = 0.90


async def main():
    execu = build_from_env()
    if execu is None:
        print("ERROR: HoodExecutor is None. Missing key or eth-account.")
        return 2

    print(f"[init] wallet={execu.address}")

    bal_before = await execu.refresh_eth_balance()
    print(f"[balance] {bal_before:.6f} ETH  (halted={execu.is_halted()} dry_run={execu.is_dry_run()})")
    if bal_before < BUY_ETH * 3:
        print(f"ERROR: balance too low; need ~{BUY_ETH * 3:.4f} ETH for buy + gas + sell gas")
        return 3

    print(f"\n[quote] asking QuoterV2 for {BUY_ETH} ETH -> PONS...")
    fee, out = await execu._best_fee_tier(
        "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
        PONS_ADDR,
        int(BUY_ETH * 10**18),
    )
    print(f"[quote] best_fee={fee} best_out_raw={out}")
    if fee is None or out <= 0:
        print("ERROR: no route found; aborting")
        return 4

    print(f"\n[BUY] {BUY_ETH} ETH -> PONS ...")
    buy = await execu.buy(PONS_ADDR, PONS_SYMBOL, BUY_ETH, PONS_LIQ_USD, BUY_CONFIDENCE)
    print(f"[BUY] status={buy.status} tx={buy.tx_hash} error={buy.error}")
    if buy.status not in ("confirmed", "dry_run"):
        print("ERROR: buy failed; aborting sell")
        return 5

    if buy.status == "dry_run":
        print("(dry-run mode: not sending real tx)")
        return 0

    print("\n[wait] sleeping 12s for tx to land / balances to update...")
    await asyncio.sleep(12)

    pos = execu.open_positions.get(PONS_ADDR.lower())
    if not pos:
        print("ERROR: no open position recorded for PONS after buy")
        return 6

    amt_out = int(pos.get("amount_out_raw", 0))
    print(f"[position] amount_raw={amt_out} fee_tier={pos.get('fee_tier')}")

    print(f"\n[SELL] {amt_out} PONS raw units -> WETH ...")
    sell = await execu.sell(PONS_ADDR, PONS_SYMBOL, amt_out, PONS_LIQ_USD)
    print(f"[SELL] status={sell.status} tx={sell.tx_hash} error={sell.error}")

    await asyncio.sleep(10)
    bal_after = await execu.refresh_eth_balance()
    print(f"\n[balance] before={bal_before:.6f} after={bal_after:.6f} delta={bal_after-bal_before:+.6f} ETH")
    print(f"\n[DONE] buy={buy.tx_hash} sell={sell.tx_hash}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
