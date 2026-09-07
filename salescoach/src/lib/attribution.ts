/** Client-safe attribution helpers (no DB imports). */

export const ATTRIBUTION_COOKIE = "sc_attr";

export type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingPath?: string;
};

export function parseAttributionCookie(raw: string | undefined): Attribution {
  if (!raw) return {};
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const str = (k: string) => (typeof data[k] === "string" ? (data[k] as string).slice(0, 200) : "");
    return {
      utmSource: str("utmSource") || str("utm_source"),
      utmMedium: str("utmMedium") || str("utm_medium"),
      utmCampaign: str("utmCampaign") || str("utm_campaign"),
      utmContent: str("utmContent") || str("utm_content"),
      utmTerm: str("utmTerm") || str("utm_term"),
      referrer: str("referrer"),
      landingPath: str("landingPath"),
    };
  } catch {
    return {};
  }
}
