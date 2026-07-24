import { createHmac, timingSafeEqual } from "crypto";
import { sessionSecret } from "./config";

const SESSION_DAYS = 14;

function sign(userId: string, expiresAtMs: number): string {
  const payload = `${userId}.${expiresAtMs}`;
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function mintSessionToken(userId: string, days = SESSION_DAYS): string {
  const expiresAtMs = Date.now() + days * 24 * 60 * 60 * 1000;
  return sign(userId, expiresAtMs);
}

/**
 * Short-lived scoped tokens for console elevation and impersonation.
 * Format: scope.subject.exp.sig — subject may be compound ("a:b").
 */
export function mintScopedToken(scope: string, subject: string, minutes: number): string {
  const expiresAtMs = Date.now() + minutes * 60 * 1000;
  const payload = `${scope}.${subject}.${expiresAtMs}`;
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** Verify a scoped token. Returns the subject or null. */
export function verifyScopedToken(scope: string, token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [tokenScope, subject, expStr, sig] = parts;
  const expiresAtMs = Number(expStr);
  if (tokenScope !== scope || !subject || !Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
    return null;
  }
  const expected = createHmac("sha256", sessionSecret())
    .update(`${tokenScope}.${subject}.${expiresAtMs}`)
    .digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return subject;
}

/** Expiry (ms epoch) of a scoped token, without verifying — for UI countdowns only. */
export function scopedTokenExpiry(token: string | undefined | null): number | null {
  const parts = token?.split(".") ?? [];
  if (parts.length !== 4) return null;
  const exp = Number(parts[2]);
  return Number.isFinite(exp) ? exp : null;
}

/** Verify a session token. Returns userId or null. */
export function verifySessionToken(
  token: string | undefined | null,
  opts?: { allowLegacyUnsigned?: boolean },
): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) {
    if (opts?.allowLegacyUnsigned && !token.includes(".")) return token;
    return null;
  }
  const [userId, expStr, sig] = parts;
  const expiresAtMs = Number(expStr);
  if (!userId || !Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return null;
  const expected = createHmac("sha256", sessionSecret())
    .update(`${userId}.${expiresAtMs}`)
    .digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return userId;
}
