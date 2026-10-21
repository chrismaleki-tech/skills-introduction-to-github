import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createProject, logTimeEntry } from "@/lib/erp-deep";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  const projects = await db.project.findMany({
    where: { orgId: user.orgId },
    include: {
      tasks: true,
      timeEntries: { orderBy: { workDate: "desc" }, take: 5 },
      _count: { select: { timeEntries: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const timeRollup = await db.timeEntry.groupBy({
    by: ["projectId"],
    where: { orgId: user.orgId },
    _sum: { hours: true },
  });
  const hoursByProject = Object.fromEntries(timeRollup.map((t) => [t.projectId, t._sum.hours ?? 0]));
  return NextResponse.json({ projects, hoursByProject });
}

export async function POST(req: Request) {
  const user = await currentUser();
  const body = (await req.json().catch(() => null)) as {
    kind?: "project" | "time";
    name?: string;
    code?: string;
    dealId?: string | null;
    accountId?: string | null;
    budgetHours?: number;
    budgetAmount?: number;
    currency?: string;
    tasks?: Array<{ title: string; estimateHrs?: number }>;
    projectId?: string;
    taskId?: string | null;
    hours?: number;
    notes?: string;
    billable?: boolean;
    workDate?: string;
  } | null;

  try {
    if (body?.kind === "time") {
      if (!body.projectId || !body.hours) {
        return NextResponse.json({ error: "projectId and hours required." }, { status: 400 });
      }
      const entry = await logTimeEntry({
        orgId: user.orgId,
        projectId: body.projectId,
        userId: user.id,
        taskId: body.taskId,
        hours: body.hours,
        notes: body.notes,
        billable: body.billable,
        workDate: body.workDate ? new Date(body.workDate) : undefined,
      });
      return NextResponse.json({ entry });
    }

    if (!isManagerRole(user.role)) {
      return NextResponse.json({ error: "Managers only." }, { status: 403 });
    }
    const name = body?.name?.trim();
    if (!name) return NextResponse.json({ error: "name required." }, { status: 400 });
    const project = await createProject({
      orgId: user.orgId,
      ownerId: user.id,
      name,
      code: body?.code,
      dealId: body?.dealId,
      accountId: body?.accountId,
      budgetHours: body?.budgetHours,
      budgetAmount: body?.budgetAmount,
      currency: body?.currency,
      tasks: body?.tasks,
    });
    return NextResponse.json({ project });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 });
  }
}
