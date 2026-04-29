import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/fees/add", destination: "/fees/generate", permanent: false }];
  },
};

export default nextConfig;
