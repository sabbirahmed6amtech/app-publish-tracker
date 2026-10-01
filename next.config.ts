import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone, for handing out a runnable build.
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
    // Every page is force-dynamic, and Next's default client cache for dynamic
    // segments is 0s — so going back to a page you just left refetched it from
    // scratch. Holding the payload briefly makes revisits instant.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
