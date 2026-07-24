import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { requireConsole } from "@/lib/platform-admin";
import { IMPERSONATION_COOKIE, IMPERSONATION_SCOPE } from "@/lib/session";
import { mintScopedToken } from "@/lib/session-token";
import { consoleRoleForUser, impersonationMinutes } from "@/lib/config";
import { recordAudit } from "@/lib/audit";

/**
 * Start a time-boxed, read-only "view as customer" session. The product UI
 * renders as the target user; all mutations are blocked at the middleware;
 * start/end are audited and customer-visible on the org's Settings page.
 */
export async function POST(req: Request) {
  const actor = await requireConsole("SUPPORT");
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { userId?: string };
  if (!body.userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });

  const target = await db.user.findUnique({ where: { id: body.userId }, include: { org: true } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (target.id === actor.user.id || consoleRoleForUser(target)) {
    return NextResponse.json({ error: "Cannot impersonate platform staff." }, { status: 400 });
  }

  const minutes = impersonationMinutes();
  const store = await cookies();
  store.set(
    IMPERSONATION_COOKIE,
    mintScopedToken(IMPERSONATION_SCOPE, `${target.id}:${actor.user.id}`, minutes),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: minutes * 60,
    },
  );
  await recordAudit({
    actor: actor.user,
    consoleRole: actor.role,
    action: "IMPERSONATION_STARTED",
    targetType: "USER",
    targetId: target.id,
    orgId: target.orgId,
    req,
    meta: { targetEmail: target.email, org: target.org.name, minutes },
  });
  return NextResponse.json({ ok: true, minutes, org: target.org.name });
}
