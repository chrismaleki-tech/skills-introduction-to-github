import Link from "next/link";
import { Card, EmptyState, fmtDateTime, ScoreBadge } from "@/components/ui";

type Msg = {
  id: string;
  direction: string;
  subject: string;
  body: string;
  status: string;
  fromAddress: string;
  toAddress: string;
  durationSec: number | null;
  occurredAt: Date | string;
  callId?: string | null;
  sender?: { id: string; name: string } | null;
  call?: { id: string; status: string; grade?: { overallScore: number } | null } | null;
};

type Convo = {
  id: string;
  channel: string;
  subject: string;
  prospectAddress: string;
  lastMessageAt: Date | string;
  messages: Msg[];
  contact?: { id: string; name: string } | null;
  deal?: { id: string; name: string } | null;
};

export function ConversationPanels({ conversations }: { conversations: Convo[] }) {
  if (conversations.length === 0) {
    return (
      <Card title="Conversations">
        <EmptyState
          title="No email or phone conversations yet"
          hint="Connect your channels, then email or call the prospect — threads appear here."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {conversations.map((c) => (
        <Card
          key={c.id}
          title={`${c.channel === "EMAIL" ? "Email" : "Phone"} · ${c.subject || c.prospectAddress}`}
          action={
            <span className="text-xs text-muted">{fmtDateTime(c.lastMessageAt)}</span>
          }
        >
          <div className="text-xs text-muted mb-4">
            {c.prospectAddress}
            {c.contact ? ` · ${c.contact.name}` : ""}
          </div>
          <ul className="space-y-3">
            {c.messages.map((m) => {
              const outbound = m.direction === "OUTBOUND";
              return (
                <li
                  key={m.id}
                  className={`rounded-lg border px-3 py-2.5 ${
                    outbound
                      ? "border-accent/25 bg-accent/5 ml-6"
                      : "border-line bg-surface-2/60 mr-6"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    <span className="uppercase tracking-wider">{m.direction}</span>
                    <span>{fmtDateTime(m.occurredAt)}</span>
                    {m.sender?.name && <span>· {m.sender.name}</span>}
                    {m.durationSec != null && <span>· {m.durationSec}s</span>}
                    {m.call?.grade?.overallScore != null && (
                      <ScoreBadge score={m.call.grade.overallScore} size="sm" />
                    )}
                  </div>
                  {m.subject && <div className="text-sm font-medium mt-1">{m.subject}</div>}
                  <p className="text-sm text-muted mt-1 whitespace-pre-wrap">{m.body}</p>
                  {m.callId && (
                    <Link
                      href={`/calls/${m.callId}`}
                      className="text-xs text-accent-hover hover:underline mt-1 inline-block"
                    >
                      Open SalesCoach review →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
