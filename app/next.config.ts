import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3", "elkjs"],
  outputFileTracingRoot: appRoot,
  turbopack: {
    root: appRoot,
  },
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
