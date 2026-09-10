import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { NewContactForm } from "@/components/crm/forms";
import Link from "next/link";

export default async function ContactsPage() {
  const user = await currentUser();
  const [contacts, accounts] = await Promise.all([
    db.contact.findMany({
      where: isManagerRole(user.role) ? { orgId: user.orgId } : { orgId: user.orgId, ownerId: user.id },
      include: {
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
        _count: { select: { deals: true, calls: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.account.findMany({
      where: { orgId: user.orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle="People at your accounts. Link them to deals and SalesCoach calls."
        actions={<NewContactForm accounts={accounts} />}
      />

      {contacts.length === 0 ? (
        <Card>
          <EmptyState title="No contacts yet" hint="Add a contact and attach them to an account." />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="text-left font-medium px-4 py-3">Contact</th>
                <th className="text-left font-medium px-4 py-3">Account</th>
                <th className="text-left font-medium px-4 py-3">Email</th>
                <th className="text-left font-medium px-4 py-3">Owner</th>
                <th className="text-right font-medium px-4 py-3">Deals</th>
                <th className="text-right font-medium px-4 py-3">Calls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2/40">
                  <td className="px-4 py-3">
                    <Link href={`/crm/contacts/${c.id}`} className="font-medium text-accent-hover hover:underline">
                      {c.name}
                    </Link>
                    {c.title && <div className="text-xs text-muted mt-0.5">{c.title}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {c.account ? (
                      <Link href={`/crm/accounts/${c.account.id}`} className="text-accent-hover hover:underline">
                        {c.account.name}
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-muted">{c.owner?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c._count.deals}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c._count.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
