import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Artwork comes straight from the content providers' own CDNs, which
    // already serve correctly sized derivatives — so the server-side
    // resize/optimize proxy is skipped and the browser fetches directly.
    unoptimized: true,
    // Every host the catalogue actually references. These are not enforced
    // while `unoptimized` is true, but listing them keeps the config honest:
    // without it, turning optimization on would break all real artwork and
    // leave only the seeded placeholders working.
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "static.tvmaze.com" },
      { protocol: "https", hostname: "cdn-images.dzcdn.net" },
      { protocol: "https", hostname: "is1-ssl.mzstatic.com" },
      // Seeded fictional catalogue entries.
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
};

export default nextConfig;
