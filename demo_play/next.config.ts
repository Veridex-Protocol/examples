import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  // Transpile SDK and its dependencies
  transpilePackages: [
    '@veridex/sdk',
    '@wormhole-foundation/wormhole-query-sdk',
    '@wormhole-foundation/sdk',
  ],
  
  // Webpack configuration to handle SDK imports
  webpack: (config, { isServer }) => {
    // Prefer CommonJS over ESM for @veridex/sdk to avoid circular dependency issues
    config.resolve.alias = {
      ...config.resolve.alias,
      '@veridex/sdk$': '@veridex/sdk/dist/index.js',
    };
    
    // Handle .mjs files
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });
    
    return config;
  },
};

export default nextConfig;
