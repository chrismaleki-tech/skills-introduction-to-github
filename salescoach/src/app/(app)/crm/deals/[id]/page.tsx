import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtMoney, stageLabel } from "@/lib/crm";
import { currentUser, isManagerRole } from "@/lib/session";
import {
  BandPill,
  Card,
  EmptyState,
  PageHeader,
  ScoreBadge,
  StatusPill,
  fmtDate,
  fmtDateTime,
} from "@/components/ui";
import { DealStageSelect } from "@/components/crm/forms";
import { ConversationPanels } from "@/components/crm/conversations";
import { EmailComposer, PhoneDialer } from "@/components/crm/outreach";
import { NewQuoteForm } from "@/components/erp/forms";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  const manager = isManagerRole(user.role);

  const deal = await db.deal.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      account: true,
      contact: true,
      owner: { select: { id: true, name: true, email: true } },
      calls: {
        include: {
          grade: true,
          rep: { select: { id: true, name: true } },
        },
        orderBy: { callDate: "desc" },
        take: 25,
      },
      activities: {
        include: { owner: { select: { id: true, name: true } } },
        orderBy: { occurredAt: "desc" },
        take: 40,
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
      quotes: { orderBy: { updatedAt: "desc" }, take: 8 },
      salesOrders: { orderBy: { updatedAt: "desc" }, take: 8 },
      invoices: { orderBy: { updatedAt: "desc" }, take: 8 },
    },
  });
  if (!deal || (!manager && deal.ownerId !== user.id)) notFound();

  const connections = await db.channelConnection.findMany({
    where: { userId: user.id, status: "CONNECTED" },
  });
  const emailConnected = connections.some((c) => c.channel === "EMAIL");
  const phoneConnected = connections.some((c) => c.channel === "PHONE");

  const [products, accounts] = await Promise.all([
    db.product.findMany({
      where: { orgId: user.orgId, active: true },
      select: { id: true, name: true, sku: true, listPrice: true, unit: true },
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
        title={deal.name}
        subtitle={`${stageLabel(deal.stage)} · ${fmtMoney(deal.amount)} · ${deal.probability}% · ${deal.product || "No product"}`}
      />

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card title="Deal" className="lg:col-span-2">
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Stage</dt>
              <dd className="mt-1">
                <DealStageSelect dealId={deal.id} stage={deal.stage} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Owner</dt>
              <dd className="mt-1">{deal.owner?.name ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Account</dt>
              <dd className="mt-1">
                {deal.account ? (
                  <Link href={`/crm/accounts/${deal.account.id}`} className="text-accent-hover hover:underline">
                    {deal.account.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Contact</dt>
              <dd className="mt-1">
                {deal.contact ? (
                  <>
                    {deal.contact.name}
                    {deal.contact.title ? <span className="text-muted"> · {deal.contact.title}</span> : null}
                    <div className="text-xs text-muted mt-0.5">
                      {[deal.contact.email, deal.contact.phone].filter(Boolean).join(" · ") || "No email/phone"}
                    </div>
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Close date</dt>
              <dd className="mt-1">{deal.closeDate ? fmtDate(deal.closeDate) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted uppercase tracking-wider">Next step</dt>
              <dd className="mt-1">{deal.nextStep || "—"}</dd>
            </div>
          </dl>
          {deal.notes && (
            <p className="mt-4 text-sm text-muted border-t border-line pt-4 whitespace-pre-wrap">{deal.notes}</p>
          )}
        </Card>

        <Card title="Reach prospect">
          <div className="space-y-4">
            <EmailComposer
              dealId={deal.id}
              contactId={deal.contactId}
              accountId={deal.accountId}
              defaultTo={deal.contact?.email || ""}
              contactName={deal.contact?.name}
              emailConnected={emailConnected}
            />
            <PhoneDialer
              dealId={deal.id}
              contactId={deal.contactId}
              accountId={deal.accountId}
              defaultTo={deal.contact?.phone || ""}
              contactName={deal.contact?.name}
              phoneConnected={phoneConnected}
              callType={deal.stage === "demo" ? "demo" : "discovery"}
            />
            <p className="text-xs text-muted border-t border-line pt-3">
              Manage connected inboxes and dialers in{" "}
              <Link href="/channels" className="text-accent-hover hover:underline">
                Channels
              </Link>
              .
            </p>
          </div>
        </Card>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">ERP documents</h2>
        <div className="grid gap-6 xl:grid-cols-3 mb-4">
          <Card title="Quotes">
            {deal.quotes.length === 0 ? (
              <p className="text-sm text-muted">No quotes yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {deal.quotes.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-2">
                    <Link href={`/erp/quotes/${q.id}`} className="text-accent-hover hover:underline truncate">
                      {q.number}
                    </Link>
                    <StatusPill status={q.status} />
                    <span className="tabular-nums text-muted">{fmtMoney(q.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Orders">
            {deal.salesOrders.length === 0 ? (
              <p className="text-sm text-muted">No orders yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {deal.salesOrders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2">
                    <Link href={`/erp/orders/${o.id}`} className="text-accent-hover hover:underline truncate">
                      {o.number}
                    </Link>
                    <StatusPill status={o.status} />
                    <span className="tabular-nums text-muted">{fmtMoney(o.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Invoices">
            {deal.invoices.length === 0 ? (
              <p className="text-sm text-muted">No invoices yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {deal.invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2">
                    <Link href={`/erp/invoices/${inv.id}`} className="text-accent-hover hover:underline truncate">
                      {inv.number}
                    </Link>
                    <StatusPill status={inv.status} />
                    <span className="tabular-nums text-muted">{fmtMoney(inv.total - inv.amountPaid)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title="Create quote for this deal">
          <NewQuoteForm
            products={products}
            deals={[{ id: deal.id, name: deal.name, accountId: deal.accountId, contactId: deal.contactId }]}
            accounts={accounts}
            defaultDealId={deal.id}
          />
        </Card>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">Conversations</h2>
        <ConversationPanels conversations={deal.conversations} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2 items-start">
        <Card title="Linked SalesCoach calls">
          {deal.calls.length === 0 ? (
            <EmptyState
              title="No linked calls yet"
              hint="Use Call prospect (grades automatically) or link an existing call from call review."
            />
          ) : (
            <ul className="divide-y divide-line -mx-1">
              {deal.calls.map((call) => (
                <li key={call.id}>
                  <Link
                    href={`/calls/${call.id}`}
                    className="flex items-center gap-3 px-1 py-3 hover:bg-surface-2/50 rounded-lg transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {call.prospectName || "Call"} · {call.callType.replaceAll("_", " ")}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {call.rep.name} · {fmtDateTime(call.callDate)}
                      </div>
                    </div>
                    <StatusPill status={call.status} />
                    {call.grade && <ScoreBadge score={call.grade.overallScore} size="sm" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Timeline">
          {deal.activities.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul className="space-y-4">
              {deal.activities.map((act) => (
                <li key={act.id} className="border-l-2 border-line pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-muted">{act.type}</span>
                    <span className="text-xs text-muted">{fmtDateTime(act.occurredAt)}</span>
                    {act.score != null && (
                      <>
                        <ScoreBadge score={act.score} size="sm" />
                        <BandPill score={act.score} />
                      </>
                    )}
                  </div>
                  <div className="text-sm font-medium mt-0.5">{act.subject}</div>
                  {act.body && (
                    <p className="text-sm text-muted mt-1 whitespace-pre-wrap line-clamp-4">{act.body}</p>
                  )}
                  {act.callId && (
                    <Link href={`/calls/${act.callId}`} className="text-xs text-accent-hover hover:underline mt-1 inline-block">
                      Open call review →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
