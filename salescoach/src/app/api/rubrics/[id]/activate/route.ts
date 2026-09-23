import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";

// POST /api/rubrics/[id]/activate — make an org-owned rubric the team's active methodology.

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!isManagerRole(user.role)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const rubric = await db.methodology.findUnique({ where: { id } });
  if (!rubric || rubric.isPreset || rubric.orgId !== user.orgId) {
    return NextResponse.json(
      { error: "Only rubrics owned by your team can be set active. Clone a preset first." },
      { status: 404 },
    );
  }

  await db.org.update({ where: { id: user.orgId }, data: { activeMethodologyId: id } });
  return NextResponse.json({ ok: true });
}
