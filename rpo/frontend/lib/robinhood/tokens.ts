/**
 * Canonical Robinhood Chain stock-token registry.
 *
 * Every address in this file is a real, live contract on
 * Robinhood Chain (chain id 4663). These are the underlying
 * assets an RPO SubscriptionVault will buy when the protocol
 * goes live — they exist independently of RPO and can be read
 * from the RPC right now.
 *
 * Source: `rpo/contracts/addresses.robinhood.json`, verified
 * against https://rpc.mainnet.chain.robinhood.com — every
 * address returns real bytecode and the Chainlink feeds return
 * live prices.
 */

export type StockToken = {
  ticker: string;
  name: string;
  address: `0x${string}`;
  priceFeed: `0x${string}`;
  /** ERC-20 decimals; verified onchain. */
  decimals: number;
  /** SEC-style asset class. */
  assetClass: "US Equity" | "ETF";
};

/**
 * Every entry below has:
 *  - real ERC-20 bytecode on Robinhood Chain (verified via eth_getCode)
 *  - a real Chainlink price feed returning live latestRoundData()
 *  - real 18-decimal ERC-20 supply
 *
 * Additional tickers can be added here as Robinhood mints more
 * Stock Tokens — the runtime auto-picks them up.
 */
export const STOCK_TOKENS: StockToken[] = [
  {
    ticker: "NVDA",
    // Verified onchain name(): "NVIDIA • Robinhood Token"
    name: "NVIDIA · Robinhood Token",
    address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
    priceFeed: "0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15",
    decimals: 18,
    assetClass: "US Equity",
  },
  {
    ticker: "AAPL",
    // Verified onchain name(): "Apple • Robinhood Token"
    name: "Apple · Robinhood Token",
    address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
    priceFeed: "0x6B22A786bAa607d76728168703a39Ea9C99f2cD0",
    decimals: 18,
    assetClass: "US Equity",
  },
  {
    ticker: "SPY",
    // Verified onchain name(): "SPDR S&P 500 ETF Trust • Robinhood Token"
    name: "SPDR S&P 500 ETF · Robinhood Token",
    address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C",
    priceFeed: "0x319724394D3A0e3669269846abE664Cd621f9f6A",
    decimals: 18,
    assetClass: "ETF",
  },
];

export function findStockToken(ticker: string): StockToken | undefined {
  const t = ticker.toUpperCase();
  return STOCK_TOKENS.find((s) => s.ticker.toUpperCase() === t);
}

/**
 * Canonical Robinhood Chain infrastructure addresses. Same source,
 * same verification — every one is deployed and reachable.
 */
export const RH_INFRA = {
  USDG:            "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as `0x${string}`,
  WETH:            "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as `0x${string}`,
  UniversalRouter: "0x8876789976dEcBfCbBbe364623C63652db8C0904" as `0x${string}`,
} as const;
