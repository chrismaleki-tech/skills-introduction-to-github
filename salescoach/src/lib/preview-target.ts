/** Clerk development secret keys use this prefix. Production keys use sk_live_. */
export const CLERK_DEVELOPMENT_KEY_PREFIX = "sk_test_";

/** The only database the live preview audit is allowed to write. */
export const PREVIEW_AUDIT_DATABASE = "erota_preview";

/** Production Vercel alias. The preview audit must not target it. */
export const PRODUCTION_VERCEL_HOST = "erota-salescoach.vercel.app";

export function assertClerkDevelopmentKey(key: string | undefined): string {
  const value = key?.trim() ?? "";
  if (!value) throw new Error("CLERK_SECRET_KEY is not set.");
  if (!value.startsWith(CLERK_DEVELOPMENT_KEY_PREFIX)) {
    throw new Error("Refusing CLERK_SECRET_KEY. The preview audit accepts only a Clerk development secret key.");
  }
  return value;
}

export function previewConnectionTarget(connectionString: string | undefined): { host: string; database: string } {
  if (!connectionString?.trim()) {
    throw new Error("DATABASE_URL is not set. The preview audit will not choose a connection.");
  }
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL could not be parsed. The preview audit did not connect.");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const host = url.hostname;
  if (!host) throw new Error("Refusing to connect: DATABASE_URL has no host.");
  if (database === "neondb") throw new Error("Refusing to connect: database name is neondb.");
  if (database !== PREVIEW_AUDIT_DATABASE) {
    throw new Error(`Refusing to connect: database name is "${database || "blank"}", expected ${PREVIEW_AUDIT_DATABASE}.`);
  }
  return { host, database };
}

export function previewBaseUrl(raw: string | undefined): URL {
  if (!raw?.trim()) throw new Error("ADMIN_PREVIEW_BASE_URL is not set.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("ADMIN_PREVIEW_BASE_URL is not a URL.");
  }
  if (url.protocol !== "https:") throw new Error("The preview base URL must use https.");
  if (url.hostname === PRODUCTION_VERCEL_HOST) {
    throw new Error(`Refusing ${PRODUCTION_VERCEL_HOST}. That hostname is the production deployment.`);
  }
  if (!url.hostname.endsWith(".vercel.app")) {
    throw new Error(`Refusing host ${url.hostname}. Point ADMIN_PREVIEW_BASE_URL at the preview deployment.`);
  }
  url.hash = "";
  url.search = "";
  url.pathname = "";
  return url;
}
