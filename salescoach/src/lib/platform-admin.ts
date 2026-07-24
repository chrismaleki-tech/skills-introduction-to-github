import { cookies } from "next/headers";
import { rawSessionUserOrNull, consoleSessionUser, impersonationInfo } from "./session";
import { consoleRoleForUser, type ConsoleRole } from "./config";
import { verifyScopedToken, scopedTokenExpiry } from "./session-token";

export const ELEVATION_COOKIE = "sc_admin";
export const ELEVATION_SCOPE = "elev";
export { impersonationInfo };

export type ConsoleActor = {
  user: NonNullable<Awaited<ReturnType<typeof rawSessionUserOrNull>>>;
  role: ConsoleRole;
  elevated: boolean;
  elevationExpiresAtMs: number | null;
  elevationMinutesLeft: number;
};

/**
 * Resolve the current console actor. The console is a separate control plane:
 * it requires (a) a product session belonging to a workforce-allowlisted email
 * (or, in demo auth mode with no allowlists configured, the demo fallback
 * user) and (b) a short-lived elevation token minted by step-up re-auth.
 * Uses the raw session so the actor stays the employee even mid-impersonation.
 */
export async function consoleActor(): Promise<ConsoleActor | null> {
  const user = await consoleSessionUser().catch(() => null);
  if (!user) return null;
  const role = consoleRoleForUser(user);
  if (!role) return null;

  const store = await cookies();
  const token = store.get(ELEVATION_COOKIE)?.value;
  const subject = verifyScopedToken(ELEVATION_SCOPE, token);
  const elevated = subject === user.id;
  const expiresAtMs = elevated ? scopedTokenExpiry(token) : null;
  return {
    user,
    role,
    elevated,
    elevationExpiresAtMs: expiresAtMs,
    elevationMinutesLeft: expiresAtMs ? Math.max(0, Math.round((expiresAtMs - Date.now()) / 60000)) : 0,
  };
}

/**
 * Gate for /api/admin routes. minRole "SUPPORT" admits both console roles;
 * "ADMIN" admits only full platform admins. Elevation is always required.
 */
export async function requireConsole(minRole: ConsoleRole): Promise<ConsoleActor | null> {
  const actor = await consoleActor();
  if (!actor || !actor.elevated) return null;
  if (minRole === "ADMIN" && actor.role !== "ADMIN") return null;
  return actor;
}

/** Back-compat helper (full admin + elevated). */
export async function platformAdminOrNull() {
  const actor = await requireConsole("ADMIN");
  return actor?.user ?? null;
}
