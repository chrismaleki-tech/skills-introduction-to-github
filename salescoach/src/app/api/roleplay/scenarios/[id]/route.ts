import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { normalizeScenario, type ScenarioInput } from "@/lib/scenario-input";

async function ownedScenario(id: string, orgId: string) {
  const scenario = await db.scenario.findUnique({
    where: { id },
    include: { _count: { select: { roleplays: true, assignments: true } } },
  });
  if (!scenario || scenario.orgId !== orgId) return null;
  return scenario;
}

// Edit a scenario in place. Sessions already played keep referencing it, so
// the persona brief they show reflects the current version — acceptable, and
// far better than forcing a copy for every typo fix.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only managers and trainers can edit scenarios" }, { status: 403 });
  }
  const scenario = await ownedScenario(id, user.orgId);
  if (!scenario) return NextResponse.json({ error: "Scenario not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as ScenarioInput;
  const parsed = normalizeScenario(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;

  await db.scenario.update({
    where: { id },
    data: {
      title: v.title,
      callType: v.callType,
      difficulty: v.difficulty,
      personaJson: JSON.stringify(v.persona),
      winConditionsJson: JSON.stringify(v.winConditions),
    },
  });
  return NextResponse.json({ id });
}

// Delete a scenario. Manager-only, and only when no sessions reference it so
// existing session history never loses its scenario context.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only managers can delete scenarios" }, { status: 403 });
  }

  const scenario = await ownedScenario(id, user.orgId);
  if (!scenario) return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  if (scenario._count.roleplays > 0) {
    return NextResponse.json(
      { error: "Scenario has sessions against it and cannot be deleted" },
      { status: 409 },
    );
  }
  if (scenario._count.assignments > 0) {
    return NextResponse.json(
      { error: "Scenario is referenced by assignments and cannot be deleted" },
      { status: 409 },
    );
  }

  await db.scenario.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
