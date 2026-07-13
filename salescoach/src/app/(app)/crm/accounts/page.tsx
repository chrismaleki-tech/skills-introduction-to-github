import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { NewAccountForm } from "@/components/crm/forms";

export default async function AccountsPage() {
  const user = await currentUser();
  const accounts = await db.account.findMany({
    where: isManagerRole(user.role) ? { orgId: user.orgId } : { orgId: user.orgId, ownerId: user.id },
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { contacts: true, deals: true, calls: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Companies in your CRM. Deals and SalesCoach calls hang off these accounts."
        actions={<NewAccountForm />}
      />

      {accounts.length === 0 ? (
        <Card>
          <EmptyState title="No accounts yet" hint="Create an account to attach contacts and deals." />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="text-left font-medium px-4 py-3">Account</th>
                <th className="text-left font-medium px-4 py-3">Industry</th>
                <th className="text-left font-medium px-4 py-3">Owner</th>
                <th className="text-right font-medium px-4 py-3">Contacts</th>
                <th className="text-right font-medium px-4 py-3">Deals</th>
                <th className="text-right font-medium px-4 py-3">Calls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-surface-2/40">
                  <td className="px-4 py-3">
                    <Link href={`/crm/accounts/${a.id}`} className="font-medium text-accent-hover hover:underline">
                      {a.name}
                    </Link>
                    {a.domain && <div className="text-xs text-muted mt-0.5">{a.domain}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted">{a.industry || "—"}</td>
                  <td className="px-4 py-3 text-muted">{a.owner?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{a._count.contacts}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{a._count.deals}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{a._count.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
