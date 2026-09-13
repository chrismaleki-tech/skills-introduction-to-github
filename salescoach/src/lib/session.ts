import { cookies } from "next/headers";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";

export { hashPassword, verifyPassword };

// Session cookie auth with password login. Demo switcher remains available when
// ALLOW_DEMO_SWITCHER=true (default in development) so managers can still
// preview every role without logging out.

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
  store.set(COOKIE, userId, {
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
  const id = store.get(COOKIE)?.value;
  if (!id) return null;
  return db.user.findUnique({ where: { id }, include: { org: true } });
}

export async function currentUser() {
  const user = await currentUserOrNull();
  if (user) return user;
  // Dev convenience only: seed managers can open the app before first login.
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
  const users = await db.user.findMany({ include: { org: true } });
  const user = users.find((u) => u.email.toLowerCase() === normalized);
  if (!user?.passwordHash) {
    return { ok: false as const, error: "Invalid email or password." };
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { ok: false as const, error: "Invalid email or password." };
  await setSessionUser(user.id);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { ok: true as const, user };
}

export function isManagerRole(role: string) {
  return role === "MANAGER" || role === "ADMIN" || role === "TRAINER";
}
