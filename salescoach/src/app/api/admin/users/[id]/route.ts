import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/session";
import { requireConsole } from "@/lib/platform-admin";
import { recordAudit } from "@/lib/audit";

const ROLES = new Set(["REP", "MANAGER", "TRAINER", "ADMIN"]);

/**
 * PATCH /api/admin/users/[id] — platform-admin user maintenance:
 * reset password and/or change role. Fixes the "invited without a password,
 * can't log in" onboarding gap. ADMIN console role only; fully audited.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireConsole("ADMIN");
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, orgId: true },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { password?: string; role?: string };
  const data: { passwordHash?: string; role?: string } = {};

  if (body.password != null) {
    const password = body.password.trim();
    if (password.length < 10) {
      return NextResponse.json({ error: "Password must be at least 10 characters." }, { status: 400 });
    }
    data.passwordHash = await hashPassword(password);
  }
  if (body.role != null) {
    const role = body.role.toUpperCase();
    if (!ROLES.has(role)) {
      return NextResponse.json({ error: `Invalid role. Use: ${[...ROLES].join(", ")}` }, { status: 400 });
    }
    data.role = role;
  }
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to update. Send password and/or role." }, { status: 400 });
  }

  await db.user.update({ where: { id }, data });

  if (data.passwordHash) {
    await recordAudit({
      actor: actor.user,
      consoleRole: actor.role,
      action: "USER_PASSWORD_RESET",
      targetType: "USER",
      targetId: user.id,
      orgId: user.orgId,
      req,
      meta: { email: user.email },
    });
  }
  if (data.role) {
    await recordAudit({
      actor: actor.user,
      consoleRole: actor.role,
      action: "USER_ROLE_CHANGED",
      targetType: "USER",
      targetId: user.id,
      orgId: user.orgId,
      req,
      meta: { email: user.email, from: user.role, to: data.role },
    });
  }

  return NextResponse.json({ ok: true, passwordReset: Boolean(data.passwordHash), role: data.role });
}
