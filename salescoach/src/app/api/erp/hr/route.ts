import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payrollAccrualSnapshot, postMonthlyPayrollJournal } from "@/lib/erp-deep";
import { currentUser, isManagerRole } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }
  const [employees, snapshot] = await Promise.all([
    db.employee.findMany({
      where: { orgId: user.orgId },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    }),
    payrollAccrualSnapshot(user.orgId),
  ]);
  return NextResponse.json({ employees, snapshot });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as {
    kind?: "employee" | "payroll_journal";
    name?: string;
    email?: string;
    title?: string;
    department?: string;
    employmentType?: string;
    salaryAnnual?: number;
    currency?: string;
    userId?: string | null;
    managerName?: string;
  } | null;

  try {
    if (body?.kind === "payroll_journal") {
      const entry = await postMonthlyPayrollJournal(user.orgId, user.id);
      return NextResponse.json({ entry });
    }

    const name = body?.name?.trim();
    if (!name || !body) return NextResponse.json({ error: "name required." }, { status: 400 });
    const employee = await db.employee.create({
      data: {
        orgId: user.orgId,
        name,
        email: body.email?.trim() ?? "",
        title: body.title?.trim() ?? "",
        department: body.department?.trim() || "General",
        employmentType: body.employmentType || "full_time",
        salaryAnnual: Math.max(0, Math.round(Number(body.salaryAnnual) || 0)),
        currency: body.currency || "USD",
        userId: body.userId || null,
        managerName: body.managerName?.trim() ?? "",
        hireDate: new Date(),
        status: "active",
      },
    });
    return NextResponse.json({ employee });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 400 });
  }
}
