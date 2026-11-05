import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, fmtDateTime } from "@/components/ui";

export default async function ConversationsPage() {
  const user = await currentUser();
  const conversations = await db.conversation.findMany({
    where: isManagerRole(user.role) ? { orgId: user.orgId } : { orgId: user.orgId, ownerId: user.id },
    include: {
      contact: { select: { id: true, name: true } },
      deal: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      messages: { orderBy: { occurredAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 80,
  });

  return (
    <div>
      <PageHeader
        title="Conversations"
        subtitle="Email threads and phone conversations from connected employee channels, attached to CRM deals and contacts."
      />

      {conversations.length === 0 ? (
        <Card>
          <EmptyState
            title="No conversations yet"
            hint="Connect channels, then email or call a prospect from a deal."
          />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="text-left font-medium px-4 py-3">Channel</th>
                <th className="text-left font-medium px-4 py-3">Subject</th>
                <th className="text-left font-medium px-4 py-3">Prospect</th>
                <th className="text-left font-medium px-4 py-3">Deal</th>
                <th className="text-left font-medium px-4 py-3">Owner</th>
                <th className="text-right font-medium px-4 py-3">Msgs</th>
                <th className="text-right font-medium px-4 py-3">Last</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {conversations.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2/40">
                  <td className="px-4 py-3">
                    <span className="text-[11px] uppercase tracking-wider text-muted">{c.channel}</span>
                  </td>
                  <td className="px-4 py-3">
                    {c.deal ? (
                      <Link href={`/crm/deals/${c.deal.id}`} className="font-medium text-accent-hover hover:underline">
                        {c.subject || "(no subject)"}
                      </Link>
                    ) : (
                      <span className="font-medium">{c.subject || "(no subject)"}</span>
                    )}
                    {c.messages[0] && (
                      <div className="text-xs text-muted mt-0.5 line-clamp-1">{c.messages[0].body}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.contact?.name || c.prospectAddress || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {c.deal ? (
                      <Link href={`/crm/deals/${c.deal.id}`} className="text-accent-hover hover:underline">
                        {c.deal.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{c.owner.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c._count.messages}</td>
                  <td className="px-4 py-3 text-right text-muted whitespace-nowrap">
                    {fmtDateTime(c.lastMessageAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
