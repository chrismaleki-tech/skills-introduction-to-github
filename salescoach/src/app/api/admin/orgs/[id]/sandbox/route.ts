import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/session";
import { requireConsole } from "@/lib/platform-admin";
import { recordAudit } from "@/lib/audit";

/**
 * POST /api/admin/orgs/[id]/sandbox — clone a tenant's CONFIGURATION into a
 * safe testing workspace: customization, policies, methodologies, company
 * context, and scenarios. Deliberately no customer data (users, calls, CRM,
 * ERP, grades) — a sandbox is where changes get rehearsed, not a data copy.
 * Sandboxes are excluded from billing rollups and the vendor CRM.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireConsole("ADMIN");
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await params;
  const source = await db.org.findUnique({
    where: { id },
    include: {
      methodologies: { where: { orgId: id } },
      companyContext: true,
      scenarios: true,
    },
  });
  if (!source) return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  if (source.kind === "sandbox") {
    return NextResponse.json({ error: "Cannot create a sandbox of a sandbox." }, { status: 400 });
  }

  const tempPassword = randomBytes(12).toString("base64url");
  const adminEmail = `sandbox-${Date.now().toString(36)}@${source.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}.sandbox`;

  const sandbox = await db.org.create({
    data: {
      name: `${source.name} (Sandbox)`,
      kind: "sandbox",
      plan: source.plan,
      customizationJson: source.customizationJson,
      ingestionPolicyJson: source.ingestionPolicyJson,
      retentionPolicyJson: source.retentionPolicyJson,
      baseCurrency: source.baseCurrency,
      defaultTaxCode: source.defaultTaxCode,
      users: {
        create: {
          name: "Sandbox Admin",
          email: adminEmail,
          role: "ADMIN",
          title: "Sandbox administrator",
          passwordHash: await hashPassword(tempPassword),
        },
      },
    },
  });

  // Clone methodologies, remembering the active one's new id.
  let activeMethodologyId: string | null = null;
  for (const methodology of source.methodologies) {
    const clone = await db.methodology.create({
      data: {
        orgId: sandbox.id,
        name: methodology.name,
        description: methodology.description,
        isPreset: methodology.isPreset,
        dimensionsJson: methodology.dimensionsJson,
      },
    });
    if (methodology.id === source.activeMethodologyId) activeMethodologyId = clone.id;
  }
  if (activeMethodologyId) {
    await db.org.update({ where: { id: sandbox.id }, data: { activeMethodologyId } });
  }

  if (source.companyContext) {
    await db.companyContext.create({
      data: { orgId: sandbox.id, profileJson: source.companyContext.profileJson },
    });
  }
  for (const scenario of source.scenarios) {
    await db.scenario.create({
      data: {
        orgId: sandbox.id,
        title: scenario.title,
        callType: scenario.callType,
        difficulty: scenario.difficulty,
        personaJson: scenario.personaJson,
        winConditionsJson: scenario.winConditionsJson,
      },
    });
  }

  await recordAudit({
    actor: actor.user,
    consoleRole: actor.role,
    action: "SANDBOX_CREATED",
    targetType: "ORG",
    targetId: sandbox.id,
    orgId: source.id,
    req,
    meta: {
      source: source.name,
      sandbox: sandbox.name,
      methodologies: source.methodologies.length,
      scenarios: source.scenarios.length,
    },
  });

  return NextResponse.json({
    ok: true,
    sandboxOrgId: sandbox.id,
    name: sandbox.name,
    adminEmail,
    // Shown once, like all one-time secrets in the console.
    temporaryPassword: tempPassword,
  });
}
