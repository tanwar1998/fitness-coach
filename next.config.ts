import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  cacheComponents: true,
  serverExternalPackages: ["pg", "@langchain/core", "@langchain/langgraph"],
  experimental: {
    turbopackChunking: {
      minChunkSize: 30000,
      maxChunkCountPerGroup: 80,
      maxMergeChunkSize: 100000,
    },
  },
};

export default nextConfig;
