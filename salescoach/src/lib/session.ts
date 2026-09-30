import { cookies } from "next/headers";
import { db } from "./db";

// Demo authentication: a cookie holds the active user id and the header has a
// user switcher, so every role (rep / manager / trainer / admin) is one click
// away. Production swaps this for a real auth provider (see README).

const COOKIE = "sc_user";

export async function currentUser() {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (id) {
    const user = await db.user.findUnique({ where: { id }, include: { org: true } });
    if (user) return user;
  }
  // Default to the first manager so the app never renders logged-out.
  const fallback = await db.user.findFirst({
    where: { role: "MANAGER" },
    include: { org: true },
    orderBy: { createdAt: "asc" },
  });
  if (!fallback) throw new Error("Database not seeded — run `npm run db:seed`.");
  return fallback;
}

export const SESSION_COOKIE = COOKIE;

export function isManagerRole(role: string) {
  return role === "MANAGER" || role === "ADMIN" || role === "TRAINER";
}
