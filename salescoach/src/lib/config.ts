/**
 * Production configuration gates.
 * Call assertProductionConfig() from boot paths (worker, instrumentation)
 * so misconfigured deploys fail fast instead of running insecurely.
 */

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (isProduction()) {
    throw new Error(
      "SESSION_SECRET is required in production. Generate one with: openssl rand -base64 48",
    );
  }
  // Dev-only fallback — never use in production.
  return "dev-only-session-secret-change-me";
}

export function assertProductionConfig(): string[] {
  const missing: string[] = [];
  if (!isProduction()) return missing;

  if (!process.env.SESSION_SECRET?.trim()) missing.push("SESSION_SECRET");
  if (!process.env.DATABASE_URL?.trim()) missing.push("DATABASE_URL");
  if (process.env.ALLOW_DEMO_SWITCHER === "true" || process.env.ALLOW_DEMO_SWITCHER === "1") {
    missing.push("ALLOW_DEMO_SWITCHER must be false/unset in production");
  }
  if (missing.length) {
    throw new Error(`Production config invalid: ${missing.join(", ")}`);
  }
  return missing;
}

/** True when object storage is configured for multi-instance deploys. */
export function objectStorageConfigured() {
  return Boolean(process.env.S3_BUCKET?.trim() && process.env.S3_ACCESS_KEY_ID?.trim());
}

/**
 * Demo auth (cookie-less fallback user + user switcher) — defaults on outside
 * production, and can be forced with ALLOW_DEMO_SWITCHER. Production asserts
 * this is off (see assertProductionConfig).
 */
export function demoAuthAllowed() {
  if (process.env.ALLOW_DEMO_SWITCHER != null) {
    return process.env.ALLOW_DEMO_SWITCHER === "true" || process.env.ALLOW_DEMO_SWITCHER === "1";
  }
  return !isProduction();
}

function emailSet(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function platformAdminEmails(): Set<string> {
  return emailSet(process.env.PLATFORM_ADMIN_EMAILS);
}

export function platformSupportEmails(): Set<string> {
  return emailSet(process.env.PLATFORM_SUPPORT_EMAILS);
}

export function isPlatformAdminEmail(email: string) {
  return platformAdminEmails().has(email.trim().toLowerCase());
}

/** True once either workforce allowlist has been configured. */
export function consoleAllowlistConfigured() {
  return platformAdminEmails().size > 0 || platformSupportEmails().size > 0;
}

/** Console role for a workforce email: ADMIN (full), SUPPORT (read + impersonate), or null. */
export type ConsoleRole = "ADMIN" | "SUPPORT";
export function consoleRoleForEmail(email: string): ConsoleRole | null {
  const normalized = email.trim().toLowerCase();
  if (platformAdminEmails().has(normalized)) return "ADMIN";
  if (platformSupportEmails().has(normalized)) return "SUPPORT";
  return null;
}

/**
 * Console role for a user. Strictly the email allowlists — except in demo
 * auth mode with NO allowlist configured, where seeded MANAGER/ADMIN users
 * get full console access so /admin is explorable out of the box. Production
 * always requires PLATFORM_ADMIN_EMAILS / PLATFORM_SUPPORT_EMAILS.
 */
export function consoleRoleForUser(user: { email: string; role: string }): ConsoleRole | null {
  const byEmail = consoleRoleForEmail(user.email);
  if (byEmail) return byEmail;
  if (
    !consoleAllowlistConfigured() &&
    demoAuthAllowed() &&
    !isProduction() &&
    (user.role === "MANAGER" || user.role === "ADMIN")
  ) {
    return "ADMIN";
  }
  return null;
}

/** Lifetime of an elevated console session (short-lived by design). */
export function adminSessionMinutes(): number {
  const n = Number(process.env.ADMIN_SESSION_MINUTES);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

/** Lifetime of an impersonation ("view as customer") session. */
export function impersonationMinutes(): number {
  const n = Number(process.env.IMPERSONATION_MINUTES);
  return Number.isFinite(n) && n > 0 ? n : 30;
}
