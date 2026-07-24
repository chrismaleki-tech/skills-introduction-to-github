import { cookies } from "next/headers";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { consoleRoleForEmail, isPlatformAdminEmail } from "./config";
import { mintSessionToken, verifySessionToken, verifyScopedToken, scopedTokenExpiry } from "./session-token";

export { hashPassword, verifyPassword };
export { mintSessionToken, verifySessionToken };

const COOKIE = "sc_user";
const SESSION_DAYS = 14;

export const SESSION_COOKIE = COOKIE;
export const IMPERSONATION_COOKIE = "sc_imp";
export const IMPERSONATION_SCOPE = "imp";

export function demoSwitcherAllowed() {
  if (process.env.ALLOW_DEMO_SWITCHER != null) {
    return process.env.ALLOW_DEMO_SWITCHER === "true" || process.env.ALLOW_DEMO_SWITCHER === "1";
  }
  return process.env.NODE_ENV !== "production";
}

export async function setSessionUser(userId: string) {
  const store = await cookies();
  store.set(COOKIE, mintSessionToken(userId, SESSION_DAYS), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** The product session itself — ignores impersonation. */
export async function rawSessionUserOrNull() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  const id = verifySessionToken(token, { allowLegacyUnsigned: demoSwitcherAllowed() });
  if (!id) return null;
  return db.user.findUnique({ where: { id }, include: { org: true } });
}

export type ImpersonationInfo = {
  admin: { id: string; email: string; name: string };
  target: NonNullable<Awaited<ReturnType<typeof rawSessionUserOrNull>>>;
  expiresAtMs: number | null;
};

/**
 * Active "view as customer" session, if any. The sc_imp cookie carries
 * "targetId:adminId" and is only honored while the underlying product session
 * still belongs to that workforce-allowlisted admin — a stolen impersonation
 * cookie is useless on its own.
 */
export async function impersonationInfo(): Promise<ImpersonationInfo | null> {
  const store = await cookies();
  const token = store.get(IMPERSONATION_COOKIE)?.value;
  const subject = verifyScopedToken(IMPERSONATION_SCOPE, token);
  if (!subject) return null;
  const [targetId, adminId] = subject.split(":");
  if (!targetId || !adminId) return null;

  const admin = await rawSessionUserOrNull();
  if (!admin || admin.id !== adminId || !consoleRoleForEmail(admin.email)) return null;

  const target = await db.user.findUnique({ where: { id: targetId }, include: { org: true } });
  if (!target) return null;
  return {
    admin: { id: admin.id, email: admin.email, name: admin.name },
    target,
    expiresAtMs: scopedTokenExpiry(token),
  };
}

export async function currentUserOrNull() {
  const impersonation = await impersonationInfo();
  if (impersonation) return impersonation.target;
  return rawSessionUserOrNull();
}

export async function currentUser() {
  const user = await currentUserOrNull();
  if (user) return user;
  if (demoSwitcherAllowed()) {
    const fallback = await db.user.findFirst({
      where: { role: "MANAGER" },
      include: { org: true },
      orderBy: { createdAt: "asc" },
    });
    if (fallback) return fallback;
  }
  throw new Error("UNAUTHENTICATED");
}

export async function loginWithPassword(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const candidates = await db.user.findMany({ include: { org: true }, take: 500 });
  const matched = candidates.find((u) => u.email.toLowerCase() === normalized) ?? null;

  if (!matched?.passwordHash) {
    return { ok: false as const, error: "Invalid email or password." };
  }
  const valid = await verifyPassword(password, matched.passwordHash);
  if (!valid) return { ok: false as const, error: "Invalid email or password." };
  await setSessionUser(matched.id);
  await db.user.update({ where: { id: matched.id }, data: { lastLoginAt: new Date() } });
  return { ok: true as const, user: matched };
}

export function isManagerRole(role: string) {
  return role === "MANAGER" || role === "ADMIN" || role === "TRAINER";
}

export function isOrgAdminRole(role: string) {
  return role === "ADMIN";
}

export function userIsPlatformAdmin(user: { email: string; role: string }) {
  // Strictly allowlist-based: org-level ADMINs manage their own org, but
  // platform scope (creating orgs, cross-tenant views) needs PLATFORM_ADMIN_EMAILS.
  return isPlatformAdminEmail(user.email);
}
