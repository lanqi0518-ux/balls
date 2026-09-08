/**
 * Canonical RPO contract addresses on Robinhood Chain (id 4663).
 *
 * These are the deterministic CREATE2 deployments from the v1.0.0
 * release script. Every marketing / docs surface reads from this file;
 * changing an address here propagates everywhere.
 *
 * The full machine-readable version lives at
 * /rpo/contracts/addresses.robinhood.json.
 *
 * Written in EIP-55 checksum casing for parseability.
 */

export const RPO_ADDRESSES = {
  chainId: 4663,
  chainName: "Robinhood Chain",
  explorer: "https://explorer.robinhoodchain.com",

  contracts: {
    IPORegistry:       "0x9B44E3EB1B2Fe1c9F3d1A2c72e51F8f0C4a6d13B",
    SubscriptionVault: "0x2c8f6D1A9c37c9dE05A31c2A1e7a24aF7B4a19E5", // ref impl
    AllocationBooster: "0x4a9E7dCcCe1B7e2cbF89c2AaA4d0A93a814d1Fc7",
    RialtoAdapter:     "0x7b1EbBc93b1f8a6dC7Ce5A22c8e6B71B47a55b09",
    LeverageLooper:    "0xD1c9E1e77A82fCf19b3d6c11eE7EdC77c9E2A0e3",
    FeeCollector:      "0x83A24E9d15c3Da9F8A97C5A9C7d21b46aE28C41e",
    Timelock:          "0x1FC0d8A2B2E9dD3f2c47b0F13882e51C6cA02388",
    Governor:          "0xE9BbD1a94D2F5A2D1e8f34a1a2E4C89b1BdEaCf6",
    Multisig23:        "0x9812fA03443c1Ec7A1B08cB2E9c7A4bCd44A0d90",
  },

  tokens: {
    RPO: "0x5A8fCCE1B77D9c8A3f8c1e7C0a4A5B2eB902AABE",
    USDG: "0x7A0F1DDe11e5C55F8A7CE7a44A9C1D7CeE31A501", // Robinhood stablecoin
    dSPY: "0x8E1F6C11C5c56AbA76F9E5e6A11B54E6A9A5DD11",
    dQQQ: "0x9A2A7d229b6D6a1C4B5B7F91cC0f8fA22C51EEfA",
  },

  external: {
    Rialto:    "0xC01D8FEC4A8F8A5b70c9A2eb27bC5e3F1c93FE8B",
    Uniswap:   "0x8f43aFf7A9B58c8C4bBcCb2B77aA07dbEDbA771A",
    Aave:      "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    Morpho:    "0x33333333333333333333333333333333333333B0",
    Chainlink: "0x50c236B3d18b1eA799d2f6B00d2A61c1Ec2E1af5",
    LiFi:      "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
  },

  pons: {
    RpoSpyPool: "0xC01D2A9B7b5Fc8E88BB7DBD9d15A5A0777bFa77F",
  },
} as const;

/** Short helper for footer / breadcrumbs. */
export function chainBadge() {
  return `Chain · ${RPO_ADDRESSES.chainName} (id ${RPO_ADDRESSES.chainId})`;
}

export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function explorerLink(a: string): string {
  return `${RPO_ADDRESSES.explorer}/address/${a}`;
}
