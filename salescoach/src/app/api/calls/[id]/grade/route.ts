import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processCall } from "@/lib/pipeline";
import { currentUser, isManagerRole } from "@/lib/session";

// On-demand grading: "grade this call now" for ungraded calls and retry for
// FAILED ones. A rep grading their own call is the rep-flag path; a manager
// requesting it is recorded as MANAGER_REQUESTED. Neither consumes the
// sampling budget (see src/lib/sampling.ts).

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const manager = isManagerRole(user.role);

  const call = await db.call.findFirst({
    where: { id, orgId: user.orgId },
    include: { grade: true },
  });
  if (!call || (!manager && call.repId !== user.id)) {
    return NextResponse.json({ error: "Call not found." }, { status: 404 });
  }

  await db.call.update({
    where: { id: call.id },
    data: {
      failReason: null,
      // Only rewrite the sampling reason when this is the call's first grade;
      // a retry of an already-sampled call keeps its original status.
      ...(call.grade ? {} : { samplingStatus: manager ? "MANAGER_REQUESTED" : "REP_FLAGGED" }),
    },
  });

  try {
    await processCall(call.id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Grading failed." },
      { status: 500 },
    );
  }

  const grade = await db.grade.findUnique({ where: { callId: call.id } });
  if (!grade) {
    return NextResponse.json({ error: "Grading finished without a grade." }, { status: 500 });
  }
  return NextResponse.json({ overallScore: grade.overallScore });
}
