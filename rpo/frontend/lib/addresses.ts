/**
 * Pre-launch placeholder for the protocol's canonical mainnet
 * address book. Nothing is deployed yet — all values are the zero
 * address until $RPO launches on Pons and the contracts land on
 * Robinhood Chain. Marketing / docs surfaces read from here so
 * flipping a single file post-launch propagates everywhere.
 *
 * The runtime `/app` UX does NOT read from this file. It reads
 * from `lib/chain.ts` which pulls addresses from
 * `NEXT_PUBLIC_*_ADDRESS` env vars, so the moment envs are set
 * the entire application goes live with zero code changes.
 */

export const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export const RPO_ADDRESSES = {
  chainId: 4663,
  chainName: "Robinhood Chain",
  /**
   * The canonical Robinhood Chain block explorer will be set once the
   * network's official explorer is live. Until then, links point to
   * the Robinhood Chain docs so users understand the address is not
   * yet deployed.
   */
  explorer: "https://docs.robinhood.com/chain/",

  /**
   * All addresses will be populated by the deploy script — see
   * `rpo/docs/GO_LIVE.md`. Kept as the zero address deliberately so
   * that no surface pretends to link to a deployed contract that
   * doesn't exist yet.
   */
  contracts: {
    IPORegistry:       ZERO_ADDR,
    SubscriptionVault: ZERO_ADDR,
    AllocationBooster: ZERO_ADDR,
    RialtoAdapter:     ZERO_ADDR,
    AssetDiscovery:    ZERO_ADDR,
    Faucet:            ZERO_ADDR,
    Timelock:          ZERO_ADDR,
    Governor:          ZERO_ADDR,
  },

  tokens: {
    RPO:  ZERO_ADDR,
    /** Canonical USDG on Robinhood Chain, published by RHJ. */
    USDG: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    /** Robinhood-Chain stock tokens (`dTicker`) will be published by RHJ. */
    dSPY: ZERO_ADDR,
  },

  pons: {
    RpoSpyPool: ZERO_ADDR,
  },

  /**
   * External integrations. All zero until the integration is actually
   * deployed on Robinhood Chain and verified by the counterparty.
   */
  external: {
    Chainlink: ZERO_ADDR,
    Rialto:    ZERO_ADDR,
    Uniswap:   ZERO_ADDR,
    Aave:      ZERO_ADDR,
    Morpho:    ZERO_ADDR,
    LiFi:      ZERO_ADDR,
  },
} as const;

export function chainBadge() {
  return `Chain · ${RPO_ADDRESSES.chainName} (id ${RPO_ADDRESSES.chainId})`;
}

export function shortAddr(a: string): string {
  if (!a || a === ZERO_ADDR) return "not deployed";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function explorerLink(a: string): string {
  if (!a || a === ZERO_ADDR) return RPO_ADDRESSES.explorer;
  return `${RPO_ADDRESSES.explorer}/address/${a}`;
}

/**
 * Return true when the given address has been set to a real,
 * non-zero value. Callers can also invoke `isDeployed()` with no
 * argument to check whether the core protocol is live.
 */
export function isDeployed(addr?: string): boolean {
  if (typeof addr === "string") {
    return !!addr && addr !== ZERO_ADDR;
  }
  return (
    RPO_ADDRESSES.contracts.IPORegistry !== ZERO_ADDR &&
    RPO_ADDRESSES.contracts.AllocationBooster !== ZERO_ADDR
  );
}
