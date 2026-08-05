import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtMoney, stageLabel } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { parseCustomization, industryConfigOf } from "@/lib/customization";
import { parseCustomValues } from "@/lib/industry";
import { CustomFieldsCard } from "@/components/crm/custom-fields";
import { Card, EmptyState, PageHeader, ScoreBadge, fmtDateTime } from "@/components/ui";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  const manager = isManagerRole(user.role);
  const industry = industryConfigOf(parseCustomization(user.org.customizationJson));

  const account = await db.account.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      owner: { select: { id: true, name: true } },
      contacts: { orderBy: { name: "asc" } },
      deals: {
        include: { owner: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
      },
      calls: {
        include: { grade: true, rep: { select: { name: true } } },
        orderBy: { callDate: "desc" },
        take: 15,
      },
      activities: {
        where: { type: "COACHING" },
        orderBy: { occurredAt: "desc" },
        take: 10,
      },
    },
  });
  if (!account || (!manager && account.ownerId !== user.id)) notFound();

  return (
    <div>
      <PageHeader
        title={account.name}
        subtitle={[account.industry, account.size, account.domain].filter(Boolean).join(" · ") || industry.terms.account}
      />

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card title="Profile" className="lg:col-span-2">
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Website</dt>
              <dd className="mt-1">{account.website || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Owner</dt>
              <dd className="mt-1">{account.owner?.name ?? "—"}</dd>
            </div>
          </dl>
          {account.notes && <p className="mt-4 text-sm text-muted border-t border-line pt-4">{account.notes}</p>}
          {industry.accountFields.length > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <div className="text-xs text-muted uppercase tracking-wider mb-3">
                {industry.packName} details
              </div>
              <CustomFieldsCard
                endpoint={`/api/crm/accounts/${account.id}`}
                fields={industry.accountFields}
                values={parseCustomValues(account.customJson)}
              />
            </div>
          )}
        </Card>
        <Card title="Coaching on this account">
          {account.activities.length === 0 ? (
            <p className="text-sm text-muted">No coaching scorecards yet.</p>
          ) : (
            <ul className="space-y-3">
              {account.activities.map((a) => (
                <li key={a.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    {a.score != null && <ScoreBadge score={a.score} size="sm" />}
                    <span className="text-xs text-muted">{fmtDateTime(a.occurredAt)}</span>
                  </div>
                  <div className="mt-0.5 font-medium">{a.subject}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Contacts">
          {account.contacts.length === 0 ? (
            <EmptyState title="No contacts" />
          ) : (
            <ul className="divide-y divide-line">
              {account.contacts.map((c) => (
                <li key={c.id} className="py-3">
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {[c.title, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Deals">
          {account.deals.length === 0 ? (
            <EmptyState title="No deals" />
          ) : (
            <ul className="divide-y divide-line">
              {account.deals.map((d) => (
                <li key={d.id} className="py-3">
                  <Link href={`/crm/deals/${d.id}`} className="text-sm font-medium text-accent-hover hover:underline">
                    {d.name}
                  </Link>
                  <div className="text-xs text-muted mt-0.5">
                    {stageLabel(d.stage)} · {fmtMoney(d.amount)}
                    {d.owner ? ` · ${d.owner.name}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {account.calls.length > 0 && (
        <Card title="Recent calls" className="mt-6">
          <ul className="divide-y divide-line">
            {account.calls.map((call) => (
              <li key={call.id} className="py-3 flex items-center gap-3">
                <Link href={`/calls/${call.id}`} className="flex-1 text-sm hover:text-accent-hover">
                  {call.prospectName || "Call"} · {call.rep.name} · {fmtDateTime(call.callDate)}
                </Link>
                {call.grade && <ScoreBadge score={call.grade.overallScore} size="sm" />}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
