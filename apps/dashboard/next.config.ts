import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

type DashboardWebpackConfig = {
  cache?: false | {
    compression?: false | "gzip" | "brotli";
  };
};

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: {
    cpus: 1,
  },
  output: process.platform === "win32" ? undefined : "standalone",
  reactStrictMode: true,
  webpack(config: DashboardWebpackConfig, { dev }) {
    if (dev && config.cache && typeof config.cache === "object") {
      config.cache.compression = false;
    }

    return config;
  },
  headers() {
    return Promise.resolve([
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ]);
  },
  transpilePackages: [
    "@responix/ui",
    "@responix/types",
    "@responix/utils",
    "@responix/shared",
    "@responix/design-system",
    "@responix/auth",
    "@responix/state",
    "@responix/api-client",
  ],
};

export default withNextIntl(nextConfig);
