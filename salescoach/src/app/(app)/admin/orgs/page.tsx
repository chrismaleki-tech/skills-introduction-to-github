import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, Card, EmptyState, fmtDate } from "@/components/ui";
import { CreateOrgForm } from "@/components/admin/org-forms";

export default async function AdminOrgsPage() {
  const orgs = await db.org.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { users: true, calls: true, deals: true } },
    },
  });

  return (
    <div>
      <PageHeader title="Organizations" subtitle="Every tenant on the platform. Create a new customer org here." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={`Tenants (${orgs.length})`} className="lg:col-span-2">
          {orgs.length === 0 ? (
            <EmptyState title="No organizations yet" hint="Create the first tenant with the form." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted uppercase tracking-wider border-b border-line">
                  <th className="pb-2 font-medium">Organization</th>
                  <th className="pb-2 font-medium text-right">Users</th>
                  <th className="pb-2 font-medium text-right">Calls</th>
                  <th className="pb-2 font-medium text-right">Deals</th>
                  <th className="pb-2 font-medium text-right">Created</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} className="border-b border-line last:border-0">
                    <td className="py-2.5">
                      <Link href={`/admin/orgs/${org.id}`} className="font-medium text-accent-hover hover:underline">
                        {org.name}
                      </Link>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{org._count.users}</td>
                    <td className="py-2.5 text-right tabular-nums">{org._count.calls}</td>
                    <td className="py-2.5 text-right tabular-nums">{org._count.deals}</td>
                    <td className="py-2.5 text-right text-muted">{fmtDate(org.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="New organization">
          <CreateOrgForm />
        </Card>
      </div>
    </div>
  );
}
