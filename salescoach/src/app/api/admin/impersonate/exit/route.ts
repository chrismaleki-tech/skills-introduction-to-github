import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { rawSessionUserOrNull, impersonationInfo, IMPERSONATION_COOKIE } from "@/lib/session";
import { consoleRoleForEmail } from "@/lib/config";
import { recordAudit } from "@/lib/audit";

/**
 * End an impersonation session. Works even if console elevation has lapsed —
 * staff must always be able to drop back to themselves.
 */
export async function POST(req: Request) {
  const info = await impersonationInfo();
  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);

  if (info) {
    await recordAudit({
      actor: { id: info.admin.id, email: info.admin.email },
      consoleRole: consoleRoleForEmail(info.admin.email) ?? "",
      action: "IMPERSONATION_ENDED",
      targetType: "USER",
      targetId: info.target.id,
      orgId: info.target.orgId,
      req,
      meta: { targetEmail: info.target.email, org: info.target.org.name },
    });
    return NextResponse.json({ ok: true });
  }

  // Cookie present but unverifiable (expired/foreign) — still clear it, and
  // attribute the exit to whoever holds the product session, if anyone.
  const user = await rawSessionUserOrNull();
  if (user && consoleRoleForEmail(user.email)) {
    await recordAudit({
      actor: user,
      consoleRole: consoleRoleForEmail(user.email) ?? "",
      action: "IMPERSONATION_ENDED",
      req,
      meta: { note: "expired or invalid impersonation token cleared" },
    });
  }
  return NextResponse.json({ ok: true });
}
