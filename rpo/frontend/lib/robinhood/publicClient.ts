import { createPublicClient, http } from "viem";
import { robinhoodChain } from "@/lib/chain";

/**
 * Server- and client-safe viem read client pinned to Robinhood Chain
 * mainnet. Used by Server Components + build-time RSC to render real
 * on-chain data (Chainlink prices, ERC-20 supply, block number) at
 * first paint — no skeletons, no simulated fallbacks.
 *
 * Uses the default public RPC baked into `robinhoodChain`. If a caller
 * wants to override at runtime with a paid RPC (e.g. for higher
 * throughput), they can set `NEXT_PUBLIC_RH_RPC_URL`.
 */
const RPC =
  process.env.NEXT_PUBLIC_RH_RPC_URL ??
  robinhoodChain.rpcUrls.default.http[0];

export const rhPublicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(RPC, {
    // Give the RPC enough headroom for a full multicall over TLS, but
    // still bounded so a dead RPC can't hang SSR indefinitely.
    timeout: 15_000,
    retryCount: 2,
    retryDelay: 250,
    // Prefer multicall batching for lower request count.
    batch: true,
  }),
  batch: {
    // Enable multicall batching so a page's individual read calls get
    // coalesced into one RPC round-trip.
    multicall: true,
  },
});
