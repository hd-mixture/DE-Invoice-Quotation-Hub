import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    "drilling-degrading-backward.ngrok-free.dev",
    "reunite-pushing-molasses.ngrok-free.dev",
    "*.ngrok-free.dev",
    "*.ngrok.io"
  ],
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  turbopack: {
    resolveAlias: {
      canvas: './src/lib/empty.ts',
    },
  },
};

export default nextConfig;
