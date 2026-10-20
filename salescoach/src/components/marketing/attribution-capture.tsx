"use client";

import { useEffect } from "react";
import { ATTRIBUTION_COOKIE } from "@/lib/attribution";
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_KEY,
} from "@/lib/consent";

/**
 * Captures UTM + referrer into a first-party cookie on marketing pages
 * so signup (webhook / first login) can attribute the acquisition.
 */
export function AttributionCapture() {
  useEffect(() => {
    function capture() {
      if (window.localStorage.getItem(COOKIE_CONSENT_KEY) !== "accepted") return;
      try {
      const url = new URL(window.location.href);
      const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
      const hasUtm = keys.some((k) => url.searchParams.get(k));
      if (!hasUtm && !document.referrer) return;

      // Don't overwrite an existing attribution cookie (first touch wins).
      if (document.cookie.split("; ").some((c) => c.startsWith(`${ATTRIBUTION_COOKIE}=`))) return;

      const payload = {
        utmSource: url.searchParams.get("utm_source") || "",
        utmMedium: url.searchParams.get("utm_medium") || "",
        utmCampaign: url.searchParams.get("utm_campaign") || "",
        utmContent: url.searchParams.get("utm_content") || "",
        utmTerm: url.searchParams.get("utm_term") || "",
        referrer: document.referrer || "",
        landingPath: url.pathname + url.search,
      };
      const maxAge = 60 * 60 * 24 * 30; // 30 days
      document.cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}; path=/; max-age=${maxAge}; SameSite=Lax`;
      } catch {
        // Attribution must never block the page.
      }
    }
    capture();
    window.addEventListener(COOKIE_CONSENT_EVENT, capture);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, capture);
  }, []);

  return null;
}
