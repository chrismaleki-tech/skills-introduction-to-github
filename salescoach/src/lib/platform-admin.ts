import { currentUser } from "./session";
import { isPlatformAdminEmail } from "./config";

/**
 * Platform-admin gate for the /admin console and cross-org APIs.
 * Strictly allowlist-based (PLATFORM_ADMIN_EMAILS): org-level ADMINs manage
 * their own org via Settings, but must never see other tenants' data.
 */
export async function platformAdminOrNull() {
  const user = await currentUser();
  return isPlatformAdminEmail(user.email) ? user : null;
}
