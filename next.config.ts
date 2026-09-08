import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  cacheComponents: true,
  serverExternalPackages: ["pg", "@langchain/core", "@langchain/langgraph"],
};

export default nextConfig;
