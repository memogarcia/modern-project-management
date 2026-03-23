import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["elkjs"],
  experimental: {
    externalDir: true,
  },
  turbopack: {
    // Shared PlanView modules live one level above the app package.
    root: path.resolve(__dirname, ".."),
  },
};

export default nextConfig;
