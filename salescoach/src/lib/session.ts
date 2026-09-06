import { cookies } from "next/headers";
import { db } from "./db";

// Demo authentication: a cookie holds the active user id and the header has a
// user switcher, so every role (rep / manager / trainer / admin) is one click
// away. Production swaps this for a real auth provider (see README).

const COOKIE = "sc_user";

export async function currentUser() {
  try {
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
    if (!fallback) {
      throw new Error(
        "Database not seeded — redeploy so build runs `db:demo`, or run `npm run db:seed` locally.",
      );
    }
    return fallback;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not seeded|Unable to open|no such table|SQLITE|datasource/i.test(msg)) {
      throw new Error(
        `Demo database unavailable (${msg}). On Vercel, set DATABASE_URL=file:./demo.db and redeploy.`,
      );
    }
    throw err;
  }
}

export const SESSION_COOKIE = COOKIE;

export function isManagerRole(role: string) {
  return role === "MANAGER" || role === "ADMIN" || role === "TRAINER";
}
