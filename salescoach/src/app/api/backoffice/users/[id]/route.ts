import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/session";
import { backofficeActor } from "@/lib/backoffice";
import { recordAudit } from "@/lib/audit";
import { planFor, seatLimitReached } from "@/lib/billing";
import { syncTenantToVendorCrm } from "@/lib/vendor-crm";

const ROLES = new Set(["REP", "MANAGER", "TRAINER", "ADMIN"]);

/**
 * PATCH /api/backoffice/users/[id] — org-side seat maintenance: change role
 * or title, reset password (returns a one-time temp password), deactivate or
 * reactivate. Org-scoped, guarded, and every mutation is audited.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await backofficeActor();
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await params;
  const target = await db.user.findUnique({
    where: { id },
    select: { id: true, orgId: true, email: true, role: true, title: true, disabledAt: true },
  });
  if (!target || target.orgId !== actor.user.orgId) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    role?: string;
    title?: string;
    resetPassword?: boolean;
    disabled?: boolean;
  };

  // Touching an ADMIN seat, or granting ADMIN, needs the org ADMIN role.
  const involvesAdmin = target.role === "ADMIN" || body.role?.toUpperCase() === "ADMIN";
  if (involvesAdmin && !actor.orgAdmin) {
    return NextResponse.json({ error: "Only org admins can manage ADMIN seats." }, { status: 403 });
  }

  let oneTimePassword: string | null = null;

  if (body.role != null) {
    const role = body.role.toUpperCase();
    if (!ROLES.has(role)) {
      return NextResponse.json({ error: `Invalid role. Use: ${[...ROLES].join(", ")}` }, { status: 400 });
    }
    if (target.id === actor.user.id) {
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
    }
    if (role !== target.role) {
      await db.user.update({ where: { id }, data: { role } });
      await recordAudit({
        actor: actor.user,
        action: "USER_ROLE_CHANGED",
        targetType: "USER",
        targetId: target.id,
        orgId: target.orgId,
        req,
        meta: { email: target.email, from: target.role, to: role },
      });
    }
  }

  if (body.title != null && body.title.trim() !== target.title) {
    await db.user.update({ where: { id }, data: { title: body.title.trim() } });
    await recordAudit({
      actor: actor.user,
      action: "USER_UPDATED",
      targetType: "USER",
      targetId: target.id,
      orgId: target.orgId,
      req,
      meta: { email: target.email, title: body.title.trim() },
    });
  }

  if (body.resetPassword) {
    oneTimePassword = randomBytes(12).toString("base64url");
    await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(oneTimePassword) } });
    await recordAudit({
      actor: actor.user,
      action: "USER_PASSWORD_RESET",
      targetType: "USER",
      targetId: target.id,
      orgId: target.orgId,
      req,
      meta: { email: target.email },
    });
  }

  if (body.disabled != null) {
    if (body.disabled && target.id === actor.user.id) {
      return NextResponse.json({ error: "You cannot deactivate your own seat." }, { status: 400 });
    }
    if (body.disabled && !target.disabledAt) {
      // Never lock the whole business out: keep at least one active admin-capable seat.
      const otherManagers = await db.user.count({
        where: {
          orgId: target.orgId,
          disabledAt: null,
          role: { in: ["MANAGER", "ADMIN"] },
          id: { not: target.id },
        },
      });
      if (otherManagers === 0) {
        return NextResponse.json(
          { error: "Cannot deactivate the last active manager or admin seat." },
          { status: 400 },
        );
      }
      await db.user.update({ where: { id }, data: { disabledAt: new Date() } });
      await recordAudit({
        actor: actor.user,
        action: "USER_DISABLED",
        targetType: "USER",
        targetId: target.id,
        orgId: target.orgId,
        req,
        meta: { email: target.email },
      });
    }
    if (!body.disabled && target.disabledAt) {
      const org = await db.org.findUniqueOrThrow({ where: { id: target.orgId }, select: { plan: true } });
      const plan = planFor(org.plan);
      const activeSeats = await db.user.count({ where: { orgId: target.orgId, disabledAt: null } });
      if (seatLimitReached(plan, activeSeats)) {
        return NextResponse.json(
          { error: `The ${plan.name} plan is limited to ${plan.seatLimit} active seats. Upgrade to reactivate this seat.` },
          { status: 402 },
        );
      }
      await db.user.update({ where: { id }, data: { disabledAt: null } });
      await recordAudit({
        actor: actor.user,
        action: "USER_ENABLED",
        targetType: "USER",
        targetId: target.id,
        orgId: target.orgId,
        req,
        meta: { email: target.email },
      });
    }
  }

  if (body.disabled != null) {
    // Seat counts changed: refresh the vendor CRM mirror.
    await syncTenantToVendorCrm(target.orgId);
  }

  return NextResponse.json({ ok: true, oneTimePassword });
}
