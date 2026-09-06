import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gradeRoleplay } from "@/lib/pipeline";
import { currentUser, isManagerRole } from "@/lib/session";
import { parseMessages } from "@/lib/types";

// End a session and grade it. Idempotent: an already-COMPLETED session is
// simply graded; an already-GRADED session returns its existing score.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();

  const session = await db.roleplaySession.findUnique({
    where: { id },
    include: { grade: true },
  });
  if (!session || session.orgId !== user.orgId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.repId !== user.id && !isManagerRole(user.role)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  if (session.status === "GRADED" && session.grade) {
    return NextResponse.json({ overallScore: session.grade.overallScore });
  }

  const repTurns = parseMessages(session.messagesJson).filter((m) => m.role === "rep").length;
  if (repTurns < 2) {
    return NextResponse.json(
      { error: "Have the conversation before grading — send at least two messages." },
      { status: 422 },
    );
  }

  if (session.status === "ACTIVE") {
    await db.roleplaySession.update({
      where: { id },
      data: {
        status: "COMPLETED",
        endedAt: new Date(),
        durationSec: Math.round((Date.now() - session.startedAt.getTime()) / 1000),
      },
    });
  }

  try {
    await gradeRoleplay(id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Grading failed" },
      { status: 500 },
    );
  }

  const grade = await db.grade.findUnique({ where: { roleplayId: id } });
  if (!grade) return NextResponse.json({ error: "Grade was not created" }, { status: 500 });
  return NextResponse.json({ overallScore: grade.overallScore });
}
