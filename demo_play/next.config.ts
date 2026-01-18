import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: ['@veridex/sdk', '@wormhole-foundation/wormhole-query-sdk'],
};

export default nextConfig;
