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
