import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtMoney, stageLabel } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, ScoreBadge, fmtDateTime } from "@/components/ui";
import { ConversationPanels } from "@/components/crm/conversations";
import { EmailComposer, PhoneDialer } from "@/components/crm/outreach";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  const manager = isManagerRole(user.role);

  const contact = await db.contact.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      account: true,
      owner: { select: { id: true, name: true } },
      deals: {
        include: { owner: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
      },
      calls: {
        include: { grade: true, rep: { select: { name: true } } },
        orderBy: { callDate: "desc" },
        take: 20,
      },
      conversations: {
        include: {
          contact: { select: { id: true, name: true } },
          deal: { select: { id: true, name: true } },
          messages: {
            orderBy: { occurredAt: "asc" },
            include: {
              sender: { select: { id: true, name: true } },
              call: { select: { id: true, status: true, grade: { select: { overallScore: true } } } },
            },
          },
        },
        orderBy: { lastMessageAt: "desc" },
      },
    },
  });
  if (!contact || (!manager && contact.ownerId !== user.id)) notFound();

  const connections = await db.channelConnection.findMany({
    where: { userId: user.id, status: "CONNECTED" },
  });

  return (
    <div>
      <PageHeader
        title={contact.name}
        subtitle={[contact.title, contact.account?.name].filter(Boolean).join(" · ") || "Contact"}
      />

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card title="Profile" className="lg:col-span-2">
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Email</dt>
              <dd className="mt-1">{contact.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Phone</dt>
              <dd className="mt-1">{contact.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Account</dt>
              <dd className="mt-1">
                {contact.account ? (
                  <Link href={`/crm/accounts/${contact.account.id}`} className="text-accent-hover hover:underline">
                    {contact.account.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Owner</dt>
              <dd className="mt-1">{contact.owner?.name ?? "—"}</dd>
            </div>
          </dl>
          {contact.notes && <p className="mt-4 text-sm text-muted border-t border-line pt-4">{contact.notes}</p>}
        </Card>

        <Card title="Reach prospect">
          <div className="space-y-4">
            <EmailComposer
              contactId={contact.id}
              accountId={contact.accountId}
              defaultTo={contact.email}
              contactName={contact.name}
              emailConnected={connections.some((c) => c.channel === "EMAIL")}
            />
            <PhoneDialer
              contactId={contact.id}
              accountId={contact.accountId}
              defaultTo={contact.phone}
              contactName={contact.name}
              phoneConnected={connections.some((c) => c.channel === "PHONE")}
            />
          </div>
        </Card>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">Conversations</h2>
        <ConversationPanels conversations={contact.conversations} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Deals">
          {contact.deals.length === 0 ? (
            <EmptyState title="No deals" />
          ) : (
            <ul className="divide-y divide-line">
              {contact.deals.map((d) => (
                <li key={d.id} className="py-3">
                  <Link href={`/crm/deals/${d.id}`} className="text-sm font-medium text-accent-hover hover:underline">
                    {d.name}
                  </Link>
                  <div className="text-xs text-muted mt-0.5">
                    {stageLabel(d.stage)} · {fmtMoney(d.amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Calls">
          {contact.calls.length === 0 ? (
            <EmptyState title="No calls" />
          ) : (
            <ul className="divide-y divide-line">
              {contact.calls.map((call) => (
                <li key={call.id} className="py-3 flex items-center gap-3">
                  <Link href={`/calls/${call.id}`} className="flex-1 text-sm hover:text-accent-hover">
                    {call.rep.name} · {fmtDateTime(call.callDate)}
                  </Link>
                  {call.grade && <ScoreBadge score={call.grade.overallScore} size="sm" />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
