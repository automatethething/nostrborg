import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  async rewrites() {
    return [
      {
        source: "/ingest/:path*",
        destination: "https://logs.petrichorlabs.ca/:path*",
      },
    ];
  },
};

export default nextConfig;
