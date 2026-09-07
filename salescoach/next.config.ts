import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Cloudflare quick-tunnel host for local demo / Google Ads preview
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
