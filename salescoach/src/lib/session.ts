import { cookies } from "next/headers";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { isPlatformAdminEmail } from "./config";
import { mintSessionToken, verifySessionToken } from "./session-token";

export { hashPassword, verifyPassword };
export { mintSessionToken, verifySessionToken };

const COOKIE = "sc_user";
const SESSION_DAYS = 14;

export const SESSION_COOKIE = COOKIE;

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

export async function currentUserOrNull() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  const id = verifySessionToken(token, { allowLegacyUnsigned: demoSwitcherAllowed() });
  if (!id) return null;
  return db.user.findUnique({ where: { id }, include: { org: true } });
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
  return isPlatformAdminEmail(user.email) || user.role === "ADMIN";
}
