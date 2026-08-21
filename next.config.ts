import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  cacheComponents: true,
  serverExternalPackages: ["pg"],
};

export default nextConfig;
