import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { backofficeActor } from "@/lib/backoffice";
import { recordAudit } from "@/lib/audit";
import { PLANS, isPlanId } from "@/lib/billing";

/**
 * POST /api/backoffice/plan — change the org's subscription plan and/or
 * billing contact. Downgrades are blocked while active seats exceed the
 * target plan's limit, so the seat math never goes silently negative.
 */
export async function POST(req: Request) {
  const actor = await backofficeActor();
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { plan?: string; billingEmail?: string };
  const org = await db.org.findUniqueOrThrow({
    where: { id: actor.user.orgId },
    select: { id: true, plan: true, billingEmail: true },
  });

  const data: { plan?: string; billingEmail?: string } = {};

  if (body.plan != null) {
    const planId = body.plan.toLowerCase();
    if (!isPlanId(planId)) {
      return NextResponse.json({ error: `Unknown plan. Use: ${Object.keys(PLANS).join(", ")}` }, { status: 400 });
    }
    if (planId !== org.plan) {
      const plan = PLANS[planId];
      const activeSeats = await db.user.count({ where: { orgId: org.id, disabledAt: null } });
      if (plan.seatLimit != null && activeSeats > plan.seatLimit) {
        return NextResponse.json(
          {
            error: `${plan.name} allows ${plan.seatLimit} active seats but you have ${activeSeats}. Deactivate seats before downgrading.`,
          },
          { status: 400 },
        );
      }
      data.plan = planId;
    }
  }

  if (body.billingEmail != null) {
    const email = body.billingEmail.trim().toLowerCase();
    if (email && !email.includes("@")) {
      return NextResponse.json({ error: "billingEmail must be a valid email." }, { status: 400 });
    }
    if (email !== org.billingEmail) data.billingEmail = email;
  }

  if (!Object.keys(data).length) return NextResponse.json({ ok: true, changed: false });

  await db.org.update({ where: { id: org.id }, data });

  if (data.plan) {
    await recordAudit({
      actor: actor.user,
      action: "PLAN_CHANGED",
      targetType: "ORG",
      targetId: org.id,
      orgId: org.id,
      req,
      meta: { from: org.plan, to: data.plan },
    });
  }
  if (data.billingEmail != null) {
    await recordAudit({
      actor: actor.user,
      action: "ORG_UPDATED",
      targetType: "ORG",
      targetId: org.id,
      orgId: org.id,
      req,
      meta: { billingEmail: data.billingEmail },
    });
  }

  return NextResponse.json({ ok: true, changed: true, plan: data.plan ?? org.plan });
}
