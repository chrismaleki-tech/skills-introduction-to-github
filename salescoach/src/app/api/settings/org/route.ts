import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { recordAudit } from "@/lib/audit";

// POST /api/settings/org — rename the org.

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Team name cannot be empty." }, { status: 400 });

  await db.org.update({ where: { id: user.orgId }, data: { name: name.slice(0, 120) } });
  await recordAudit({
    actor: user,
    action: "ORG_UPDATED",
    targetType: "ORG",
    targetId: user.orgId,
    orgId: user.orgId,
    req,
    meta: { name: name.slice(0, 120) },
  });
  return NextResponse.json({ ok: true });
}
