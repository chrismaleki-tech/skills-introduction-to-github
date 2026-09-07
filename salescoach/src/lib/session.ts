import { cookies } from "next/headers";
import { db } from "./db";
import { isClerkEnabled } from "./auth-mode";
import { provisionOrgForUser } from "./provision";
import {
  ATTRIBUTION_COOKIE,
  markSignupActivated,
  parseAttributionCookie,
} from "./signups";

// Session resolution:
// - Clerk mode: map Clerk user → DB user (auto-provision org on first login)
// - Demo mode: cookie user switcher (local/dev without Clerk keys)

const COOKIE = "sc_user";

export type AppUser = Awaited<ReturnType<typeof loadUserById>>;

async function loadUserById(id: string) {
  return db.user.findUnique({ where: { id }, include: { org: true } });
}

async function resolveClerkUser() {
  const { auth, currentUser: clerkCurrentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized — sign in required.");
  }

  const existing = await db.user.findUnique({
    where: { clerkId: userId },
    include: { org: true },
  });
  if (existing) {
    await markSignupActivated(userId);
    return existing;
  }

  const clerkUser = await clerkCurrentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress;
  if (!email) {
    throw new Error("Clerk user has no email address.");
  }
  const name =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    clerkUser?.fullName ||
    email.split("@")[0];

  const store = await cookies();
  const attribution = parseAttributionCookie(store.get(ATTRIBUTION_COOKIE)?.value);

  const user = await provisionOrgForUser({
    clerkId: userId,
    email,
    name: name || "Founder",
    source: "first_login",
    attribution,
  });

  await markSignupActivated(userId);
  return user;
}

async function resolveDemoUser() {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (id) {
    const user = await loadUserById(id);
    if (user) return user;
  }
  const fallback = await db.user.findFirst({
    where: { role: "MANAGER" },
    include: { org: true },
    orderBy: { createdAt: "asc" },
  });
  if (!fallback) {
    throw new Error(
      "Database not seeded — run `npm run db:seed` for demo mode, or configure Clerk for production.",
    );
  }
  return fallback;
}

export async function currentUser() {
  try {
    if (isClerkEnabled()) return await resolveClerkUser();
    return await resolveDemoUser();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not seeded|Unauthorized|Unable to|no such table|Prisma|database/i.test(msg)) {
      throw new Error(msg);
    }
    throw err;
  }
}

export const SESSION_COOKIE = COOKIE;

export function isManagerRole(role: string) {
  return role === "MANAGER" || role === "ADMIN" || role === "TRAINER";
}
