import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, hashPassword, userIsPlatformAdmin } from "@/lib/session";
import { randomBytes } from "crypto";

/**
 * Multi-org admin: platform admins can create additional tenants.
 * Set PLATFORM_ADMIN_EMAILS=you@company.com (comma-separated).
 */
export async function GET() {
  const actor = await currentUser();
  if (!userIsPlatformAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const orgs = await db.org.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { users: true, calls: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ orgs });
}

export async function POST(req: Request) {
  const actor = await currentUser();
  if (!userIsPlatformAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

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

  return NextResponse.json({
    orgId: org.id,
    name: org.name,
    adminUserId: org.users[0]?.id,
    adminEmail,
    // Only returned once at creation — store securely.
    temporaryPassword: body.adminPassword ? undefined : adminPassword,
  });
}
