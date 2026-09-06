import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";

interface CreateAssignmentBody {
  assignedToId?: string;
  type?: string;
  scenarioId?: string | null;
  targetCount?: number;
  dueDate?: string | null;
  note?: string;
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only managers can create assignments." }, { status: 403 });
  }

  let body: CreateAssignmentBody;
  try {
    body = (await req.json()) as CreateAssignmentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { assignedToId, type, scenarioId, note } = body;
  if (!assignedToId) return NextResponse.json({ error: "assignedToId is required." }, { status: 400 });
  if (type !== "ROLEPLAY" && type !== "UPLOAD_CALLS") {
    return NextResponse.json({ error: "type must be ROLEPLAY or UPLOAD_CALLS." }, { status: 400 });
  }

  const rep = await db.user.findFirst({ where: { id: assignedToId, orgId: user.orgId } });
  if (!rep) return NextResponse.json({ error: "Rep not found in your organization." }, { status: 400 });

  if (type === "ROLEPLAY" && !scenarioId) {
    return NextResponse.json({ error: "Role-play assignments need a scenario." }, { status: 400 });
  }
  if (scenarioId) {
    const scenario = await db.scenario.findFirst({ where: { id: scenarioId, orgId: user.orgId } });
    if (!scenario) return NextResponse.json({ error: "Scenario not found in your organization." }, { status: 400 });
  }

  const targetCount = Math.max(1, Math.min(50, Math.round(Number(body.targetCount) || 1)));
  let dueDate: Date | null = null;
  if (body.dueDate) {
    const parsed = new Date(body.dueDate);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
    }
    dueDate = parsed;
  }

  const assignment = await db.assignment.create({
    data: {
      orgId: user.orgId,
      assignedToId: rep.id,
      assignedById: user.id,
      type,
      scenarioId: type === "ROLEPLAY" ? scenarioId : null,
      targetCount,
      note: (note ?? "").trim(),
      status: "PENDING",
      dueDate,
    },
  });

  return NextResponse.json({ assignment }, { status: 201 });
}
