import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireConsole } from "@/lib/platform-admin";

/**
 * GET /api/admin/audit?orgId=&action= — read the append-only audit trail.
 * There is intentionally no POST/PATCH/DELETE: rows are written only through
 * recordAudit inside audited actions and are never edited.
 */
export async function GET(req: Request) {
  const actor = await requireConsole("SUPPORT");
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId") ?? undefined;
  const action = url.searchParams.get("action") ?? undefined;

  const events = await db.auditEvent.findMany({
    where: {
      ...(orgId ? { orgId } : {}),
      ...(action ? { action } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ events });
}
