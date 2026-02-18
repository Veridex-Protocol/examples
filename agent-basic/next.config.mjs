/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@veridex/sdk', '@veridex/agentic-payments'],
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    // Ignore problematic transitive deps from @aptos-labs/ts-sdk
    // that reference unexported paths in @noble/curves
    config.resolve.alias = {
      ...config.resolve.alias,
      '@aptos-labs/ts-sdk': false,
    };

    return config;
  },
};

export default nextConfig;
