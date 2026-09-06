import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";

// Start a text role-play session against a scenario.
export async function POST(req: Request) {
  const user = await currentUser();
  const body = (await req.json().catch(() => ({}))) as { scenarioId?: string };
  if (!body.scenarioId) {
    return NextResponse.json({ error: "scenarioId required" }, { status: 400 });
  }

  const scenario = await db.scenario.findUnique({ where: { id: body.scenarioId } });
  if (!scenario || scenario.orgId !== user.orgId) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }

  const session = await db.roleplaySession.create({
    data: {
      orgId: user.orgId,
      repId: user.id,
      scenarioId: scenario.id,
      mode: "TEXT",
      status: "ACTIVE",
      messagesJson: "[]",
    },
  });

  return NextResponse.json({ id: session.id });
}
