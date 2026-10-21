import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";

// POST /api/rubrics/[id]/clone — copy a preset (or one of the team's own rubrics)
// into an org-owned rubric the team can edit.

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!isManagerRole(user.role)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const source = await db.methodology.findUnique({ where: { id } });
  if (!source || (!source.isPreset && source.orgId !== user.orgId)) {
    return NextResponse.json({ error: "Rubric not found." }, { status: 404 });
  }

  const copy = await db.methodology.create({
    data: {
      orgId: user.orgId,
      name: `${source.name} (copy)`,
      description: source.description,
      isPreset: false,
      dimensionsJson: source.dimensionsJson,
    },
  });
  return NextResponse.json({ ok: true, id: copy.id });
}
