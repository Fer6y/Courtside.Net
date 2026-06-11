import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "www.thesportsdb.com",
      },
      {
        protocol: "https",
        hostname: "www.atptour.com",
      },
      {
        protocol: "https",
        hostname: "www.wtatennis.com",
      },
      {
        protocol: "https",
        hostname: "photoresources.wtatennis.com",
      },
    ],
  },
};

export default nextConfig;
