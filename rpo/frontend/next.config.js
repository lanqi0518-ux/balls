/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a minimal self-contained server bundle at .next/standalone.
  // Halves Docker image size and lets us `node server.js` without npm.
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  // Pages fetch live data from Nasdaq / SEC EDGAR / Robinhood RPC at
  // render time. Each individual fetch has its own AbortSignal timeout,
  // but the initial static generation still needs a larger window than
  // the 60s default when multiple slow endpoints are involved.
  staticPageGenerationTimeout: 120,
  images: {
    domains: ["cdn.robinhood.com"],
  },
  webpack: (config) => {
    // We only use `injected` and `walletConnect` from wagmi/connectors.
    // The Base Account connector (@wagmi/connectors → @base-org/account → @coinbase/cdp-sdk)
    // pulls in several unpublished `@x402/*` submodules that fail to resolve.
    // Since we never execute that code path, stub them out.
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@x402/core/client": false,
      "@x402/svm/exact/client": false,
      "@x402/evm": false,
    };
    return config;
  },
};

module.exports = nextConfig;
