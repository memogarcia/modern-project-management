import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["elkjs"],
  turbopack: {
    // Prevent Next from inferring the monorepo root (it breaks Tailwind resolution
    // when multiple lockfiles exist).
    root: ".",
  },
};

export default nextConfig;
