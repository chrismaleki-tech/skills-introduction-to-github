import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Cloudflare quick-tunnel host for local demo / Google Ads preview
  allowedDevOrigins: ["*.trycloudflare.com"],
  // Bundle the build-time seeded SQLite file into serverless functions that
  // need the demo DB (app pages + APIs that import `@/lib/db`).
  outputFileTracingIncludes: {
    "/dashboard": ["./prisma/demo.db"],
    "/me": ["./prisma/demo.db"],
    "/calls": ["./prisma/demo.db"],
    "/calls/[id]": ["./prisma/demo.db"],
    "/calls/upload": ["./prisma/demo.db"],
    "/roleplay": ["./prisma/demo.db"],
    "/roleplay/[id]": ["./prisma/demo.db"],
    "/scenarios": ["./prisma/demo.db"],
    "/scenarios/[id]": ["./prisma/demo.db"],
    "/assignments": ["./prisma/demo.db"],
    "/rubrics": ["./prisma/demo.db"],
    "/rubrics/[id]": ["./prisma/demo.db"],
    "/company": ["./prisma/demo.db"],
    "/settings": ["./prisma/demo.db"],
    "/team/[id]": ["./prisma/demo.db"],
    "/api/:path*": ["./prisma/demo.db"],
  },
};

export default nextConfig;
