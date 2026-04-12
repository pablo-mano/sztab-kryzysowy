import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/video",
        destination: "https://www.youtube.com/@pablomano/videos",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
