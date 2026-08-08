import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireConsole } from "@/lib/platform-admin";
import { recordAudit } from "@/lib/audit";
import { normalizeCustomization, parseCustomization } from "@/lib/customization";
import { PLANS, isPlanId } from "@/lib/billing";
import { syncTenantToVendorCrm, logVendorActivity } from "@/lib/vendor-crm";

/**
 * POST /api/admin/orgs/[id]/customization — vendor-side tenant provisioning:
 * the platform owner shapes a customer's workspace (branding, enabled
 * modules, start page) and can move them between editions (plans). Console
 * ADMIN + elevation required; every change is audited and visible to the
 * customer in their own audit trail.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireConsole("ADMIN");
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await params;
  const org = await db.org.findUnique({
    where: { id },
    select: { id: true, name: true, plan: true, customizationJson: true },
  });
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    customization?: unknown;
    plan?: string;
  };

  const data: { customizationJson?: string; plan?: string } = {};
  let normalized = parseCustomization(org.customizationJson);

  if (body.customization != null) {
    const result = normalizeCustomization(body.customization);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    normalized = result.value;
    data.customizationJson = JSON.stringify(result.value);
  }

  if (body.plan != null) {
    const planId = body.plan.toLowerCase();
    if (!isPlanId(planId)) {
      return NextResponse.json({ error: `Unknown plan. Use: ${Object.keys(PLANS).join(", ")}` }, { status: 400 });
    }
    // Vendor override: unlike the customer-side route, staff may downgrade an
    // over-limit org (e.g. lapsed contract); existing seats stay active and
    // the limit bites on the next invite/reactivation.
    if (planId !== org.plan) data.plan = planId;
  }

  if (!Object.keys(data).length) return NextResponse.json({ ok: true, changed: false });

  await db.org.update({ where: { id: org.id }, data });

  if (data.customizationJson) {
    await recordAudit({
      actor: actor.user,
      consoleRole: actor.role,
      action: "CUSTOMIZATION_CHANGED",
      targetType: "ORG",
      targetId: org.id,
      orgId: org.id,
      req,
      meta: {
        org: org.name,
        brandName: normalized.brandName || "(default)",
        accentColor: normalized.accentColor || "(default)",
        startPage: normalized.startPage,
        industry: normalized.industry,
        modulesOff: Object.entries(normalized.modules)
          .filter(([, on]) => !on)
          .map(([m]) => m),
      },
    });
  }
  if (data.plan) {
    await recordAudit({
      actor: actor.user,
      consoleRole: actor.role,
      action: "PLAN_CHANGED",
      targetType: "ORG",
      targetId: org.id,
      orgId: org.id,
      req,
      meta: { org: org.name, from: org.plan, to: data.plan },
    });
  }

  // Dogfooding: mirror the provisioning change onto the vendor CRM timeline.
  await syncTenantToVendorCrm(org.id);
  if (data.plan) {
    await logVendorActivity(org.id, "Edition changed", `Moved from ${org.plan} to ${data.plan} by vendor staff.`);
  }
  if (data.customizationJson) {
    const off = Object.entries(normalized.modules)
      .filter(([, on]) => !on)
      .map(([m]) => m);
    await logVendorActivity(
      org.id,
      "Workspace provisioned",
      `Brand "${normalized.brandName || "default"}", accent ${normalized.accentColor || "default"}, start ${
        normalized.startPage
      }, modules off: ${off.join(", ") || "none"}.`,
    );
  }

  return NextResponse.json({ ok: true, changed: true });
}
