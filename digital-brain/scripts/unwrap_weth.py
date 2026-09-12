"""Convert all WETH in the HOOD wallet back to native ETH."""
import asyncio, os, sys
sys.path.insert(0, "/app")
from backend.robinhood_executor import build_from_env, WETH9  # noqa: E402
from eth_abi import encode
from eth_utils import keccak


async def main():
    ex = build_from_env()
    print(f"wallet={ex.address}")
    sel_bal = keccak(text="balanceOf(address)")[:4]
    call = "0x" + (sel_bal + encode(["address"], [ex.address])).hex()
    r = await ex._rpc("eth_call", [{"to": WETH9, "data": call}, "latest"])
    wei = int(str(r.get("result") or "0x0"), 16)
    print(f"WETH balance: {wei/1e18:.6f} WETH ({wei} wei)")
    if wei == 0:
        print("nothing to unwrap")
        return 0
    # withdraw(uint256)
    sel = keccak(text="withdraw(uint256)")[:4]
    data = sel + encode(["uint256"], [wei])
    tx = await ex._send_tx(to=WETH9, data=data, value_wei=0)
    print(f"unwrap tx: {tx}")
    await asyncio.sleep(6)
    bal = await ex.refresh_eth_balance()
    print(f"native ETH after unwrap: {bal:.6f}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
