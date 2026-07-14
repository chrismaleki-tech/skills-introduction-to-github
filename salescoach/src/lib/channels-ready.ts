/** Env / credential requirements for live channel providers (pure, no DB). */

export const EMAIL_PROVIDERS = [
  { key: "demo_email", label: "Demo inbox (no OAuth)" },
  { key: "gmail", label: "Gmail / Google Workspace" },
  { key: "outlook", label: "Outlook / Microsoft 365" },
  { key: "work_smtp", label: "Work email (SMTP)" },
] as const;

export const PHONE_PROVIDERS = [
  { key: "demo_phone", label: "Demo dialer (no carrier)" },
  { key: "twilio", label: "Twilio" },
  { key: "aircall", label: "Aircall" },
  { key: "ringcentral", label: "RingCentral" },
] as const;

export function providerReady(provider: string): { ok: boolean; reason?: string } {
  if (provider.startsWith("demo")) return { ok: true };
  switch (provider) {
    case "work_smtp":
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return {
          ok: false,
          reason: "Set SMTP_HOST, SMTP_USER, SMTP_PASS (and optional SMTP_PORT) to connect work SMTP.",
        };
      }
      return { ok: true };
    case "gmail":
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return {
          ok: false,
          reason: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then complete OAuth from Channels.",
        };
      }
      return { ok: true };
    case "outlook":
      if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
        return {
          ok: false,
          reason: "Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET, then complete OAuth from Channels.",
        };
      }
      return { ok: true };
    case "twilio":
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        return {
          ok: false,
          reason: "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to place live calls.",
        };
      }
      return { ok: true };
    case "aircall":
      if (!process.env.AIRCALL_API_ID || !process.env.AIRCALL_API_TOKEN) {
        return { ok: false, reason: "Set AIRCALL_API_ID and AIRCALL_API_TOKEN." };
      }
      return { ok: true };
    case "ringcentral":
      if (!process.env.RINGCENTRAL_CLIENT_ID || !process.env.RINGCENTRAL_CLIENT_SECRET) {
        return {
          ok: false,
          reason: "Set RINGCENTRAL_CLIENT_ID and RINGCENTRAL_CLIENT_SECRET.",
        };
      }
      return { ok: true };
    default:
      return { ok: false, reason: `Unknown provider "${provider}".` };
  }
}
