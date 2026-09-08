/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["cdn.robinhood.com"],
  },
};

module.exports = nextConfig;
