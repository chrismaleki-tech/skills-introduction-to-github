import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeBackGradeToCrm } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";

// Manager calibration: override the AI score and/or leave a comment on a
// call's grade. A null score clears the override; GradeView renders both.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only managers can override grades." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { score?: number | null; comment?: string | null }
    | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let score: number | null = null;
  if (body.score != null) {
    score = Math.round(Number(body.score));
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return NextResponse.json({ error: "score must be between 0 and 100." }, { status: 400 });
    }
  }
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";

  const call = await db.call.findFirst({
    where: { id, orgId: user.orgId },
    include: { grade: true },
  });
  if (!call) {
    return NextResponse.json({ error: "Call not found." }, { status: 404 });
  }
  if (!call.grade) {
    return NextResponse.json({ error: "This call has no grade to override yet." }, { status: 404 });
  }

  const grade = await db.grade.update({
    where: { id: call.grade.id },
    data: { managerOverrideScore: score, managerComment: comment || null },
  });

  // Refresh the CRM coaching activity so manager overrides show on the deal.
  await writeBackGradeToCrm(call.id);

  return NextResponse.json({
    managerOverrideScore: grade.managerOverrideScore,
    managerComment: grade.managerComment,
  });
}
