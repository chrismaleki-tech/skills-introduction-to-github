import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();

  const assignment = await db.assignment.findFirst({ where: { id, orgId: user.orgId } });
  if (!assignment) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });

  if (assignment.assignedToId !== user.id && !isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only the assignee or a manager can complete this." }, { status: 403 });
  }

  if (assignment.status === "COMPLETED") {
    return NextResponse.json({ assignment });
  }

  const updated = await db.assignment.update({
    where: { id: assignment.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  return NextResponse.json({ assignment: updated });
}
