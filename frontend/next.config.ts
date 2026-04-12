import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/video",
        destination: "https://youtu.be/kziOB1m4A4I",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
