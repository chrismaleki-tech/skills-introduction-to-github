import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/session";
import { requireConsole } from "@/lib/platform-admin";
import { recordAudit } from "@/lib/audit";
import { syncTenantToVendorCrm, logVendorActivity } from "@/lib/vendor-crm";
import { randomBytes } from "crypto";

/**
 * Multi-org admin: platform console tenants list + creation.
 * Reads admit SUPPORT; creation requires full ADMIN. All access is gated on
 * the workforce allowlists + short-lived elevation (see lib/platform-admin).
 */
export async function GET() {
  const actor = await requireConsole("SUPPORT");
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const orgs = await db.org.findMany({
    select: {
      id: true,
      name: true,
      kind: true,
      plan: true,
      createdAt: true,
      _count: { select: { users: true, calls: true, deals: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ orgs });
}

export async function POST(req: Request) {
  const actor = await requireConsole("ADMIN");
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    adminName?: string;
    adminEmail?: string;
    adminPassword?: string;
  };

  const name = body.name?.trim();
  const adminName = body.adminName?.trim() || "Admin";
  const adminEmail = body.adminEmail?.trim().toLowerCase();
  const adminPassword = body.adminPassword?.trim() || randomBytes(12).toString("base64url");

  if (!name) {
    return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
  }
  if (!adminEmail || !adminEmail.includes("@")) {
    return NextResponse.json({ error: "adminEmail is required." }, { status: 400 });
  }
  if (adminPassword.length < 10) {
    return NextResponse.json({ error: "adminPassword must be at least 10 characters." }, { status: 400 });
  }

  const existingUser = await db.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) {
    return NextResponse.json({ error: "adminEmail is already registered." }, { status: 409 });
  }

  const org = await db.org.create({
    data: {
      name,
      users: {
        create: {
          name: adminName,
          email: adminEmail,
          role: "ADMIN",
          title: "Administrator",
          passwordHash: await hashPassword(adminPassword),
        },
      },
    },
    include: { users: true },
  });

  await recordAudit({
    actor: actor.user,
    consoleRole: actor.role,
    action: "ORG_CREATED",
    targetType: "ORG",
    targetId: org.id,
    orgId: org.id,
    req,
    meta: { name, adminEmail },
  });

  // Dogfooding: new tenants appear in the vendor CRM immediately.
  await syncTenantToVendorCrm(org.id);
  await logVendorActivity(org.id, "Tenant created", `Provisioned by ${actor.user.email} with admin ${adminEmail}.`);

  return NextResponse.json({
    orgId: org.id,
    name: org.name,
    adminUserId: org.users[0]?.id,
    adminEmail,
    // Only returned once at creation — store securely.
    temporaryPassword: body.adminPassword ? undefined : adminPassword,
  });
}
