import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { normalizeScenario, type ScenarioInput } from "@/lib/scenario-input";

// Create a scenario (managers and trainers only). Solo customers are admins
// of their own workspace, so this covers the one-person case too.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only managers and trainers can create scenarios" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as ScenarioInput;
  const parsed = normalizeScenario(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;

  const scenario = await db.scenario.create({
    data: {
      orgId: user.orgId,
      title: v.title,
      callType: v.callType,
      difficulty: v.difficulty,
      personaJson: JSON.stringify(v.persona),
      winConditionsJson: JSON.stringify(v.winConditions),
      methodologyId: user.org.activeMethodologyId,
    },
  });

  return NextResponse.json({ id: scenario.id });
}
