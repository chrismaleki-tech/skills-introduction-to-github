import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Cloudflare quick-tunnel host for local demo / Google Ads preview
  allowedDevOrigins: ["*.trycloudflare.com"],
  // Bundle the build-time seeded SQLite file into every serverless function
  // so /dashboard and other app routes can copy it to /tmp at runtime.
  outputFileTracingIncludes: {
    "/*": ["./prisma/demo.db"],
  },
};

export default nextConfig;
