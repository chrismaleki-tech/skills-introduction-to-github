import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, Card, Stat, EmptyState, fmtDateTime } from "@/components/ui";
import { sinceDaysAgo, usageSummary } from "@/lib/metering";
import { consoleActor } from "@/lib/platform-admin";
import { consoleRoleForUser } from "@/lib/config";
import { maskEmail } from "@/lib/pii";
import { parseCustomization, MODULES } from "@/lib/customization";
import { PLANS, PLAN_ORDER, planFor } from "@/lib/billing";
import { InviteUserForm } from "@/components/admin/org-forms";
import { OrgUsersCard, type ConsoleOrgUser } from "@/components/admin/org-users-card";
import { TenantCustomizationForm } from "@/components/admin/customization-form";

export default async function AdminOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await consoleActor();
  const org = await db.org.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      createdAt: true,
      plan: true,
      customizationJson: true,
      users: {
        select: { id: true, name: true, email: true, role: true, title: true, lastLoginAt: true, passwordHash: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      },
      _count: { select: { calls: true, deals: true, accounts: true, grades: true } },
    },
  });
  if (!org) notFound();

  const canManage = actor?.role === "ADMIN";
  const usage = await usageSummary(org.id, sinceDaysAgo(30));
  const customization = parseCustomization(org.customizationJson);
  const disabledModules = MODULES.filter((m) => !customization.modules[m.id]);
  const users: ConsoleOrgUser[] = org.users.map((user) => ({
    id: user.id,
    name: user.name,
    role: user.role,
    title: user.title,
    emailMasked: maskEmail(user.email),
    lastLogin: user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : null,
    hasPassword: Boolean(user.passwordHash),
    isStaff: Boolean(consoleRoleForUser(user)),
  }));

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

      <Card title="Platform customization" className="mb-6">
        <p className="text-xs text-muted mb-4">
          Provision this customer&apos;s workspace: brand, accent color, start page, licensed modules, and
          edition. Changes apply on their next page load and are recorded in both audit trails.
        </p>
        {canManage ? (
          <TenantCustomizationForm
            orgId={org.id}
            initial={customization}
            currentPlan={planFor(org.plan).id}
            plans={PLAN_ORDER.map((id) => ({
              id,
              name: PLANS[id].name,
              seatLimit: PLANS[id].seatLimit,
            }))}
          />
        ) : (
          <div className="text-sm text-muted">
            {planFor(org.plan).name} edition · brand {customization.brandName || "default"} · accent{" "}
            {customization.accentColor || "default"} · start page {customization.startPage} ·{" "}
            {disabledModules.length
              ? `modules off: ${disabledModules.map((m) => m.label).join(", ")}`
              : "all modules enabled"}
            <span className="block mt-1 text-xs">Read-only: SUPPORT role cannot provision tenants.</span>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={`Users (${org.users.length})`} className="lg:col-span-2">
          {users.length === 0 ? (
            <EmptyState title="No users" hint="Invite the first user with the form." />
          ) : (
            <OrgUsersCard orgId={org.id} users={users} canManage={canManage} />
          )}
        </Card>

        <div className="space-y-6">
          {canManage && (
            <Card title="Invite user">
              <InviteUserForm orgId={org.id} />
            </Card>
          )}

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

          <Card title="Staff access · last 90 days">
            <StaffAccess orgId={org.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}

async function StaffAccess({ orgId }: { orgId: string }) {
  const events = await db.auditEvent.findMany({
    where: {
      orgId,
      action: { in: ["IMPERSONATION_STARTED", "IMPERSONATION_ENDED", "PII_REVEALED"] },
      createdAt: { gte: sinceDaysAgo(90) },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  if (!events.length) return <EmptyState title="No staff access recorded" />;
  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div key={event.id} className="text-xs text-muted">
          <span className="text-foreground">{event.action.replaceAll("_", " ").toLowerCase()}</span>
          {" · "}
          {event.actorEmail} · {fmtDateTime(event.createdAt)}
        </div>
      ))}
    </div>
  );
}
