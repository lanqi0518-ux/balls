/**
 * Uniswap V4 primitives for Robinhood Chain.
 *
 * ────────────────────────────────────────────────────────────────
 * Deep analysis of what's live on Robinhood Chain (chain id 4663):
 *
 *  • PoolManager      = 0x8366a39cc670b4001a1121b8f6a443a643e40951
 *  • UniversalRouter  = 0x8876789976dEcBfCbBbe364623C63652db8C0904
 *      - Standard V4 selector execute(bytes,bytes[],uint256)=0x3593564c
 *      - Custom immutable getters (V4_POSITION_MANAGER, PERMIT2, WETH9)
 *        all revert — but the core V4_SWAP dispatch works fine.
 *      - Uses OLD-style ExactInputSingleParams (includes uint160
 *        sqrtPriceLimitX96 between amountOutMinimum and hookData).
 *  • Permit2          = 0x000000000022D473030F116dDEE9F6B43aC78BA3 (canonical)
 *
 * For each dSTOCK we pick the canonical no-hook / lowest-fee pool
 * that has real liquidity, verified live via extsload on the
 * PoolManager. Prices come out matching the Chainlink feeds:
 *
 *  • dNVDA — 0x8ad6d4d7... fee=30 (0.003%) tickSpacing=1 no hooks
 *  • dAAPL — 0xe5b91129... fee=250 (0.025%) tickSpacing=3 no hooks
 *  • dSPY  — 0x415de04a... fee=dynamic tickSpacing=60 hook=0xed3c...
 *
 * Currency ordering (V4 requires currency0 < currency1):
 *   USDG (0x5fc5…) < NVDA (0xd060…)  → NVDA pool: c0=USDG, c1=NVDA
 *   USDG (0x5fc5…) < AAPL (0xaF3D…)  → AAPL pool: c0=USDG, c1=AAPL
 *   SPY  (0x117C…) < USDG (0x5fc5…)  → SPY  pool: c0=SPY,  c1=USDG
 * ────────────────────────────────────────────────────────────────
 */

import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbiParameters,
  type Hex,
} from "viem";
import { RH_INFRA } from "./tokens";

export const V4_POOL_MANAGER =
  "0x8366a39cc670b4001a1121b8f6a443a643e40951" as const;
export const V4_UNIVERSAL_ROUTER = RH_INFRA.UniversalRouter;
export const PERMIT2_ADDRESS =
  "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

/** UR execute() selector for `execute(bytes commands, bytes[] inputs, uint256 deadline)`. */
export const UR_EXECUTE_SELECTOR = "0x3593564c" as const;

/** UR commands (see v4-periphery Commands.sol). */
export const CMD_V4_SWAP = 0x10;

/** V4 Actions (see v4-periphery Actions.sol). */
export const ACTION_SWAP_EXACT_IN_SINGLE = 0x06;
export const ACTION_SETTLE_ALL = 0x0c;
export const ACTION_TAKE_ALL = 0x0f;

export type PoolKey = {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
};

/**
 * Per-ticker best-liquidity pool on Robinhood Chain. Discovered live by
 * scanning PoolManager Initialize events, then filtering to pools whose
 * extsload'd liquidity is > 0.
 */
export const V4_POOLS: Record<
  string,
  {
    poolKey: PoolKey;
    /** true iff we swap USDG → dSTOCK by taking c1 (zeroForOne=true). */
    usdgIsCurrency0: boolean;
    /**
     * dSTOCK ERC-20 address. Denormalized here for convenience, but must
     * match the corresponding side of poolKey.
     */
    stockToken: `0x${string}`;
    /** dSTOCK decimals — every Robinhood Stock Token is 18. */
    stockDecimals: 18;
    /** Reference pool id (matches poolKey per V4 hashing rules). */
    poolId: `0x${string}`;
  }
> = {
  NVDA: {
    poolKey: {
      currency0: RH_INFRA.USDG,
      currency1: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
      fee: 30,
      tickSpacing: 1,
      hooks: "0x0000000000000000000000000000000000000000",
    },
    usdgIsCurrency0: true,
    stockToken: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
    stockDecimals: 18,
    poolId:
      "0x8ad6d4d7f73698bdface4841f603bff214b47510c8d85adb6aa1c982af5eeeb6",
  },
  AAPL: {
    poolKey: {
      currency0: RH_INFRA.USDG,
      currency1: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
      fee: 250,
      tickSpacing: 3,
      hooks: "0x0000000000000000000000000000000000000000",
    },
    usdgIsCurrency0: true,
    stockToken: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
    stockDecimals: 18,
    poolId:
      "0xe5b9112909fde74416b44bb2169bb89870a1363e9897151a90126aa8e140d54f",
  },
  SPY: {
    poolKey: {
      currency0: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C",
      currency1: RH_INFRA.USDG,
      fee: 8388608,
      tickSpacing: 60,
      hooks: "0xed3c7831212bca4523acce3502dd10da40680880",
    },
    usdgIsCurrency0: false,
    stockToken: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C",
    stockDecimals: 18,
    poolId:
      "0x415de04a0bb6bd66cc6a7ca58026d596ea94c4044fa697bc3bde179f727023e5",
  },
};

/**
 * Compute the canonical V4 pool id for a PoolKey. Uses the encoding
 * from v4-core: `keccak256(abi.encode(PoolKey))`.
 */
export function computePoolId(pk: PoolKey): `0x${string}` {
  const encoded = encodeAbiParameters(
    parseAbiParameters(
      "(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)"
    ),
    [
      {
        currency0: pk.currency0,
        currency1: pk.currency1,
        fee: pk.fee,
        tickSpacing: pk.tickSpacing,
        hooks: pk.hooks,
      },
    ]
  );
  return keccak256(encoded);
}

/**
 * Decode the packed Slot0 value read from PoolManager.extsload(slot0Key).
 * Layout: [sqrtPriceX96:160 | tick:24 | protocolFee:24 | lpFee:24 | ...]
 */
export function decodeSlot0(raw: bigint): {
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
} {
  const sqrtPriceX96 = raw & ((1n << 160n) - 1n);
  const tick = Number(
    BigInt.asIntN(24, (raw >> 160n) & ((1n << 24n) - 1n))
  );
  const protocolFee = Number((raw >> 184n) & ((1n << 24n) - 1n));
  const lpFee = Number((raw >> 208n) & ((1n << 24n) - 1n));
  return { sqrtPriceX96, tick, protocolFee, lpFee };
}

/**
 * Pool storage in v4-core PoolManager: `mapping(PoolId => Pool.State)` at
 * storage slot 6. The `slot0` field is the first word of the struct so
 * its slot address is `keccak256(abi.encode(poolId, 6))`.
 */
export function slotForPoolSlot0(poolId: `0x${string}`): `0x${string}` {
  const enc = encodeAbiParameters(
    parseAbiParameters("bytes32, uint256"),
    [poolId, 6n]
  );
  return keccak256(enc);
}

/** V4 PoolManager.extsload(bytes32) selector. */
export const EXTSLOAD_SELECTOR = "0x1e2eaeaf" as const;

/**
 * Given a pool's sqrtPriceX96 and directions, return a plain-JS midprice
 * expressed as `stockPerUsdg` and its inverse `usdgPerStock`, in whole
 * units (accounting for currency decimals).
 *
 * This is the mid — the actual fill will be worse by fee + slippage.
 * For a display quote it's accurate to well under 1% for < $10k fills
 * against the deep pools on RH Chain.
 */
export function midPriceUsdgPerStock(
  sqrtPriceX96: bigint,
  usdgIsCurrency0: boolean
): number {
  // price of c1 in units of c0 = (sqrtPriceX96 / 2^96)^2
  const p = (Number(sqrtPriceX96) / 2 ** 96) ** 2;
  // Decimals: USDG=6, stock=18
  if (usdgIsCurrency0) {
    // c0=USDG (6), c1=STOCK (18). price = STOCK_c0_per_STOCK_c1 = raw USDG/STOCK
    // usdgPerStock (in whole units) = (raw usdg / raw stock) * 10^(stockDec-usdgDec)
    //                                = (1/p) * 10^(18-6)  <- because we want per 1 stock (c1)
    return (1 / p) * 1e12;
  } else {
    // c0=STOCK, c1=USDG. price = raw usdg / raw stock
    // usdgPerStock (whole units) = price * 10^(18-6) = price * 1e12
    return p * 1e12;
  }
}

/**
 * Given a USDG amountIn (in raw 6-dec units), return the expected
 * stock amountOut in raw 18-dec units at the current mid.
 *
 * This ignores fees + slippage — it's a display quote only. The actual
 * on-chain swap uses `amountOutMinimum` for slippage protection.
 */
export function quoteUsdgToStockRaw(
  amountInUsdg6: bigint,
  sqrtPriceX96: bigint,
  usdgIsCurrency0: boolean
): bigint {
  const usdgPerStock = midPriceUsdgPerStock(sqrtPriceX96, usdgIsCurrency0);
  if (usdgPerStock <= 0) return 0n;
  const amountInUsdgFloat = Number(amountInUsdg6) / 1e6;
  const stockOut = amountInUsdgFloat / usdgPerStock;
  return BigInt(Math.floor(stockOut * 1e18));
}

/**
 * Encode a V4_SWAP action bundle for a single USDG → dSTOCK swap.
 *
 * Uses SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL. This variant does
 * not require a recipient — TAKE_ALL routes the delta to msg.sender
 * automatically. Simpler UX, one fewer parameter to get wrong.
 *
 * NOTE: RH Chain's UniversalRouter uses the OLD ExactInputSingleParams
 * layout (with `uint160 sqrtPriceLimitX96` between amountOutMinimum and
 * hookData). We set sqrtPriceLimitX96=0 which the pool interprets as
 * "no price limit" (fully bounded by amountOutMinimum for slippage).
 */
export function encodeSwapUsdgToStockInput(params: {
  poolKey: PoolKey;
  zeroForOne: boolean;
  amountInUsdg6: bigint;
  amountOutMinStock18: bigint;
}): Hex {
  const swapParams = encodeAbiParameters(
    parseAbiParameters(
      "((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, bool zeroForOne, uint128 amountIn, uint128 amountOutMin, uint160 sqrtPriceLimitX96, bytes hookData)"
    ),
    [
      {
        key: params.poolKey,
        zeroForOne: params.zeroForOne,
        amountIn: params.amountInUsdg6,
        amountOutMin: params.amountOutMinStock18,
        sqrtPriceLimitX96: 0n,
        hookData: "0x",
      },
    ]
  );

  const settleParams = encodeAbiParameters(
    parseAbiParameters("address, uint256"),
    [RH_INFRA.USDG, params.amountInUsdg6]
  );

  const takeParams = encodeAbiParameters(
    parseAbiParameters("address, uint256"),
    [
      params.zeroForOne ? params.poolKey.currency1 : params.poolKey.currency0,
      params.amountOutMinStock18,
    ]
  );

  const actions =
    "0x" +
    [
      ACTION_SWAP_EXACT_IN_SINGLE,
      ACTION_SETTLE_ALL,
      ACTION_TAKE_ALL,
    ]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  return encodeAbiParameters(parseAbiParameters("bytes, bytes[]"), [
    actions as `0x${string}`,
    [swapParams, settleParams, takeParams],
  ]);
}

/**
 * Encode a full UniversalRouter.execute() call for a single USDG→dSTOCK
 * V4 swap. Returned calldata is ready to send via wagmi's
 * `sendTransaction` (or `writeContract` with an ABI).
 */
export function encodeSwapCalldata(params: {
  poolKey: PoolKey;
  zeroForOne: boolean;
  amountInUsdg6: bigint;
  amountOutMinStock18: bigint;
  /** UNIX seconds. Tx reverts if `block.timestamp > deadline`. */
  deadline: bigint;
}): Hex {
  const input = encodeSwapUsdgToStockInput({
    poolKey: params.poolKey,
    zeroForOne: params.zeroForOne,
    amountInUsdg6: params.amountInUsdg6,
    amountOutMinStock18: params.amountOutMinStock18,
  });

  const commands = ("0x" +
    CMD_V4_SWAP.toString(16).padStart(2, "0")) as `0x${string}`;

  const args = encodeAbiParameters(
    parseAbiParameters("bytes, bytes[], uint256"),
    [commands, [input], params.deadline]
  );

  return (UR_EXECUTE_SELECTOR + args.slice(2)) as `0x${string}`;
}

/**
 * Minimal Permit2 ABI — just the two functions we need for the buy UX.
 */
export const PERMIT2_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
] as const;

/** Minimal V4 PoolManager ABI: just `extsload(bytes32) view returns (bytes32)`. */
export const POOL_MANAGER_ABI = [
  {
    type: "function",
    name: "extsload",
    stateMutability: "view",
    inputs: [{ name: "slot", type: "bytes32" }],
    outputs: [{ type: "bytes32" }],
  },
] as const;

/** Minimal UniversalRouter ABI: just `execute(bytes,bytes[],uint256)`. */
export const UNIVERSAL_ROUTER_ABI = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

/** Convenience helper: wrap encodeSwapCalldata's output as a wagmi write. */
export function makeSwapWriteArgs(params: {
  poolKey: PoolKey;
  zeroForOne: boolean;
  amountInUsdg6: bigint;
  amountOutMinStock18: bigint;
  deadline: bigint;
}) {
  const commands = ("0x" +
    CMD_V4_SWAP.toString(16).padStart(2, "0")) as `0x${string}`;
  const input = encodeSwapUsdgToStockInput({
    poolKey: params.poolKey,
    zeroForOne: params.zeroForOne,
    amountInUsdg6: params.amountInUsdg6,
    amountOutMinStock18: params.amountOutMinStock18,
  });
  return {
    address: V4_UNIVERSAL_ROUTER,
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: "execute" as const,
    args: [commands, [input], params.deadline] as const,
  };
}

/** Read the raw `slot0` word for a pool via `extsload`. */
export const EXTSLOAD_CALLDATA = (poolId: `0x${string}`): `0x${string}` =>
  (EXTSLOAD_SELECTOR + slotForPoolSlot0(poolId).slice(2)) as `0x${string}`;

export function assertKnownStock(ticker: string): keyof typeof V4_POOLS {
  const key = ticker.toUpperCase() as keyof typeof V4_POOLS;
  if (!(key in V4_POOLS)) {
    throw new Error(`No V4 pool configured for ${ticker}`);
  }
  return key;
}

/**
 * Suppress an unused-import warning if consumers only use one entry
 * point — keeping this in the module ensures tree-shaking still works
 * because `encodeFunctionData` is only re-exported for advanced callers
 * who want to build custom calls.
 */
export { encodeFunctionData };
