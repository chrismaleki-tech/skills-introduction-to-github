import { currentUser, isOrgAdminRole } from "./session";

/**
 * The business back office (/backoffice) is the customer org's control plane:
 * seats, plan & billing, org audit trail, and data exports. MANAGER and ADMIN
 * run the business; TRAINER stays a coaching role and REPs have no access.
 * Privilege-sensitive actions (granting/revoking ADMIN, deactivating an
 * ADMIN) additionally require the org ADMIN role — see the user route.
 */
export function isBackofficeRole(role: string) {
  return role === "MANAGER" || role === "ADMIN";
}

export type BackofficeActor = {
  user: Awaited<ReturnType<typeof currentUser>>;
  orgAdmin: boolean;
};

export async function backofficeActor(): Promise<BackofficeActor | null> {
  const user = await currentUser();
  if (!isBackofficeRole(user.role)) return null;
  return { user, orgAdmin: isOrgAdminRole(user.role) };
}
