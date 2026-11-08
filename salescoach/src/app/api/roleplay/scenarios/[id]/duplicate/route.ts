import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";

// Copy a scenario so it can be tweaked (different difficulty, different
// objection) without touching the original or its session history.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only managers and trainers can duplicate scenarios" }, { status: 403 });
  }
  const source = await db.scenario.findUnique({ where: { id } });
  if (!source || source.orgId !== user.orgId) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }

  const copy = await db.scenario.create({
    data: {
      orgId: user.orgId,
      title: `${source.title} (copy)`.slice(0, 200),
      callType: source.callType,
      difficulty: source.difficulty,
      personaJson: source.personaJson,
      winConditionsJson: source.winConditionsJson,
      methodologyId: source.methodologyId ?? user.org.activeMethodologyId,
    },
  });
  return NextResponse.json({ id: copy.id });
}
