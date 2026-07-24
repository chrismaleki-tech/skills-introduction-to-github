import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireConsole } from "@/lib/platform-admin";
import { recordAudit } from "@/lib/audit";

/**
 * POST /api/admin/orgs/[id]/pii — reveal the unmasked emails for a tenant's
 * users. PII is masked by default in the console; every reveal is audited.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireConsole("SUPPORT");
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await params;
  const org = await db.org.findUnique({
    where: { id },
    select: { id: true, users: { select: { id: true, email: true } } },
  });
  if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

  await recordAudit({
    actor: actor.user,
    consoleRole: actor.role,
    action: "PII_REVEALED",
    targetType: "ORG",
    targetId: org.id,
    orgId: org.id,
    req,
    meta: { userCount: org.users.length },
  });
  return NextResponse.json({ users: org.users });
}
