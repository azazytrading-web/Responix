import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 1
  },
  output: process.platform === "win32" ? undefined : "standalone",
  reactStrictMode: true,
  transpilePackages: ["@responix/ui", "@responix/types", "@responix/utils"]
};

export default nextConfig;
