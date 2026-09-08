/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
