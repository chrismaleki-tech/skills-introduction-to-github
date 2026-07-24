import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/session";
import { requireConsole } from "@/lib/platform-admin";
import { usageSummary, sinceDaysAgo, recordUsage } from "@/lib/metering";
import { recordAudit } from "@/lib/audit";

const ROLES = new Set(["REP", "MANAGER", "TRAINER", "ADMIN"]);

/** GET /api/admin/orgs/[id] — tenant detail for the platform admin console. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireConsole("SUPPORT");
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await params;
  const org = await db.org.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      createdAt: true,
      users: {
        select: { id: true, name: true, email: true, role: true, title: true, lastLoginAt: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      },
      _count: { select: { calls: true, deals: true, accounts: true, grades: true } },
    },
  });
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  const since = sinceDaysAgo(30);
  const usage = await usageSummary(id, since);
  return NextResponse.json({ org, usage, usageSince: since.toISOString() });
}

/** POST /api/admin/orgs/[id] — create a user inside a specific tenant. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireConsole("ADMIN");
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await params;
  const org = await db.org.findUnique({ where: { id }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    role?: string;
    title?: string;
    password?: string;
  };
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const role = (body.role || "REP").toUpperCase();
  const password = body.password?.trim() || "";

  if (!name || !email || !email.includes("@")) {
    return NextResponse.json({ error: "name and valid email are required." }, { status: 400 });
  }
  if (!ROLES.has(role)) {
    return NextResponse.json({ error: `Invalid role. Use: ${[...ROLES].join(", ")}` }, { status: 400 });
  }
  if (password && password.length < 10) {
    return NextResponse.json({ error: "Password must be at least 10 characters." }, { status: 400 });
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
  }

  const user = await db.user.create({
    data: {
      orgId: id,
      name,
      email,
      role,
      title: body.title?.trim() || "",
      passwordHash: password ? await hashPassword(password) : "",
    },
  });
  await recordUsage({
    orgId: id,
    type: "USER_SEAT",
    userId: actor.user.id,
    subjectType: "USER",
    subjectId: user.id,
  });
  await recordAudit({
    actor: actor.user,
    consoleRole: actor.role,
    action: "USER_CREATED",
    targetType: "USER",
    targetId: user.id,
    orgId: id,
    req,
    meta: { email, role, passwordSet: Boolean(password) },
  });
  return NextResponse.json({ id: user.id, email: user.email, role: user.role, passwordSet: Boolean(password) });
}
