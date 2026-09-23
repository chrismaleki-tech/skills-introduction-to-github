import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";

// Delete a scenario. Manager-only, and only when no sessions reference it so
// existing session history never loses its scenario context.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only managers can delete scenarios" }, { status: 403 });
  }

  const scenario = await db.scenario.findUnique({
    where: { id },
    include: { _count: { select: { roleplays: true, assignments: true } } },
  });
  if (!scenario || scenario.orgId !== user.orgId) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }
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
