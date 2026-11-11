import type { NextConfig } from "next";

// Public, versionless marketing/brand assets. Private or authenticated
// responses never pass through here; only these two static folders do.
const PUBLIC_ASSET_CACHE = "public, max-age=86400, stale-while-revalidate=2592000";

const nextConfig: NextConfig = {
  // Allow Cloudflare quick-tunnel host for local demo / Google Ads preview
  allowedDevOrigins: ["*.trycloudflare.com"],
  images: {
    // Optimized derivatives of the marketing images are safe to cache for a
    // month; the sources only change with a new filename or a deploy.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [
      { source: "/marketing/:path*", headers: [{ key: "Cache-Control", value: PUBLIC_ASSET_CACHE }] },
      { source: "/brand/:path*", headers: [{ key: "Cache-Control", value: PUBLIC_ASSET_CACHE }] },
    ];
  },
};

export default nextConfig;
