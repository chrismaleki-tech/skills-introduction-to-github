import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, Card, Stat, EmptyState, fmtDateTime } from "@/components/ui";
import { sinceDaysAgo, usageSummary } from "@/lib/metering";
import { InviteUserForm } from "@/components/admin/org-forms";
import { UserActions } from "@/components/admin/user-actions";

export default async function AdminOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await db.org.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      createdAt: true,
      users: {
        select: { id: true, name: true, email: true, role: true, title: true, lastLoginAt: true, passwordHash: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      },
      _count: { select: { calls: true, deals: true, accounts: true, grades: true } },
    },
  });
  if (!org) notFound();

  const usage = await usageSummary(org.id, sinceDaysAgo(30));

  return (
    <div>
      <PageHeader
        title={org.name}
        subtitle={`Tenant since ${fmtDateTime(org.createdAt)}`}
        actions={
          <Link href="/admin/orgs" className="text-sm text-muted hover:text-foreground">
            ← All organizations
          </Link>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Calls" value={org._count.calls} />
        <Stat label="Grades" value={org._count.grades} />
        <Stat label="Deals" value={org._count.deals} />
        <Stat label="Accounts" value={org._count.accounts} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={`Users (${org.users.length})`} className="lg:col-span-2">
          {org.users.length === 0 ? (
            <EmptyState title="No users" hint="Invite the first user with the form." />
          ) : (
            <div className="space-y-3">
              {org.users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm">
                      {user.name}
                      <span className="text-muted font-normal"> · {user.title || user.role.toLowerCase()}</span>
                    </div>
                    <div className="text-xs text-muted truncate">
                      {user.email}
                      {" · "}
                      {user.lastLoginAt ? `last login ${fmtDateTime(user.lastLoginAt)}` : "never logged in"}
                      {!user.passwordHash && (
                        <span className="text-amber-400"> · no password set — cannot log in</span>
                      )}
                    </div>
                  </div>
                  <UserActions userId={user.id} role={user.role} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Invite user">
            <InviteUserForm orgId={org.id} />
          </Card>

          <Card title="Usage · last 30 days">
            {usage.length === 0 ? (
              <EmptyState title="No usage events" />
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {usage.map((u) => (
                    <tr key={u.type} className="border-b border-line last:border-0">
                      <td className="py-1.5">{u.type.replaceAll("_", " ")}</td>
                      <td className="py-1.5 text-right tabular-nums">{u.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
