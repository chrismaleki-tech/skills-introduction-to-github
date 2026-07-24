import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, hashPassword, isOrgAdminRole, isManagerRole } from "@/lib/session";
import { recordUsage } from "@/lib/metering";

const ROLES = new Set(["REP", "MANAGER", "TRAINER", "ADMIN"]);

/** Invite / create a user in the current org (manager+). */
export async function POST(req: Request) {
  const actor = await currentUser();
  if (!isManagerRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

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
  const title = body.title?.trim() || "";
  const password = body.password?.trim() || "";

  if (!name || !email || !email.includes("@")) {
    return NextResponse.json({ error: "name and valid email are required." }, { status: 400 });
  }
  if (!ROLES.has(role)) {
    return NextResponse.json({ error: `Invalid role. Use: ${[...ROLES].join(", ")}` }, { status: 400 });
  }
  if (role === "ADMIN" && !isOrgAdminRole(actor.role)) {
    return NextResponse.json({ error: "Only org admins can create ADMIN users." }, { status: 403 });
  }
  if (password && password.length < 10) {
    return NextResponse.json({ error: "Password must be at least 10 characters." }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
  }

  const passwordHash = password ? await hashPassword(password) : "";
  const user = await db.user.create({
    data: {
      orgId: actor.orgId,
      name,
      email,
      role,
      title,
      passwordHash,
    },
  });

  await recordUsage({
    orgId: actor.orgId,
    type: "USER_SEAT",
    userId: actor.id,
    subjectType: "USER",
    subjectId: user.id,
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
    passwordSet: Boolean(passwordHash),
  });
}

export async function GET() {
  const actor = await currentUser();
  if (!isManagerRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const users = await db.user.findMany({
    where: { orgId: actor.orgId },
    select: { id: true, name: true, email: true, role: true, title: true, lastLoginAt: true, createdAt: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ users });
}
