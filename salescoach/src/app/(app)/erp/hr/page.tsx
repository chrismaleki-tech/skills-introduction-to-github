import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/crm";
import { payrollAccrualSnapshot } from "@/lib/erp-deep";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, Stat, StatusPill } from "@/components/ui";
import { NewEmployeeForm, PayrollJournalButton } from "@/components/erp/deep-forms";

export default async function HrPage() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) notFound();

  const [employees, snapshot] = await Promise.all([
    db.employee.findMany({
      where: { orgId: user.orgId },
      include: { user: { select: { name: true, role: true } } },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    }),
    payrollAccrualSnapshot(user.orgId),
  ]);

  return (
    <div>
      <PageHeader
        title="HR & payroll"
        subtitle="Employee roster and monthly payroll accrual into the general ledger."
      />
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Stat label="Headcount" value={snapshot.headcount} />
        <Stat label="Annual payroll" value={fmtMoney(snapshot.annualPayroll)} />
        <Stat label="Monthly accrual" value={fmtMoney(snapshot.monthlyAccrual)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card title="Add employee">
          <NewEmployeeForm />
        </Card>
        <Card title="Payroll journal">
          <p className="text-sm text-muted mb-4">
            Posts debit Payroll Expense / credit AP for the current month (idempotent per YYYY-MM).
          </p>
          <PayrollJournalButton />
          <ul className="mt-4 text-sm divide-y divide-line">
            {snapshot.byDepartment.map((d) => (
              <li key={d.department} className="py-2 flex justify-between gap-3">
                <span>
                  {d.department} <span className="text-xs text-muted">({d.count})</span>
                </span>
                <span className="tabular-nums text-muted">{fmtMoney(d.annual)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Employees">
        {employees.length === 0 ? (
          <EmptyState title="No employees" />
        ) : (
          <ul className="divide-y divide-line">
            {employees.map((e) => (
              <li key={e.id} className="py-3 flex flex-wrap items-start justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-xs text-muted">
                    {[e.title, e.department, e.email].filter(Boolean).join(" · ")}
                    {e.user ? ` · linked ${e.user.role}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <StatusPill status={e.status} />
                  <div className="tabular-nums text-muted mt-1">{fmtMoney(e.salaryAnnual, e.currency)}/yr</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
