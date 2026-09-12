import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // All artwork is external placeholder imagery (picsum.photos) — skip the
    // server-side resize/optimize proxy and let the browser fetch it directly.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "fastly.picsum.photos",
      },
    ],
  },
};

export default nextConfig;
