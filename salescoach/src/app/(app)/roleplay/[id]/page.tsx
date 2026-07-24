import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { parseMessages, parsePersona, parseStringArray, type TranscriptSegment } from "@/lib/types";
import { Card, EmptyState, PageHeader, StatusPill, fmtDateTime, fmtDuration } from "@/components/ui";
import { GradeView } from "@/components/grade-view";
import { TranscriptView } from "@/components/transcript-view";
import { RoleplayChat } from "@/components/roleplay/chat";
import { DifficultyPill, fmtCallType } from "@/components/roleplay/difficulty-pill";
import { GradeSessionButton } from "@/components/roleplay/grade-session-button";

export default async function RoleplaySessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const manager = isManagerRole(user.role);

  const session = await db.roleplaySession.findUnique({
    where: { id },
    include: { scenario: true, rep: true, grade: true },
  });
  if (!session || session.orgId !== user.orgId) notFound();
  const isOwner = session.repId === user.id;
  if (!isOwner && !manager) notFound();

  const persona = parsePersona(session.scenario.personaJson);
  const winConditions = parseStringArray(session.scenario.winConditionsJson);
  const messages = parseMessages(session.messagesJson);

  const briefing = (
    <Card title="Scenario briefing" className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-medium">
            {persona.name}
            {persona.title && <span className="text-muted"> — {persona.title}</span>}
          </div>
          <div className="text-sm text-muted mt-0.5">
            {[persona.company, persona.industry].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted capitalize">{fmtCallType(session.scenario.callType)} call</span>
          <DifficultyPill difficulty={session.scenario.difficulty} />
        </div>
      </div>
      {winConditions.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1.5">A winning conversation</div>
          <ul className="space-y-1 text-sm">
            {winConditions.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent-hover shrink-0">•</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );

  // --- ACTIVE voice session waiting for Vapi webhook ---
  if (session.status === "ACTIVE" && session.mode === "VOICE" && isOwner) {
    return (
      <div>
        <PageHeader
          title={session.scenario.title}
          subtitle="Voice session is live — complete the call in Vapi. Grading starts when the end-of-call webhook arrives."
          actions={<StatusPill status={session.status} />}
        />
        {briefing}
        <Card title="Voice role-play">
          <p className="text-sm text-muted mb-3">
            If a join URL opened in a new tab, finish the conversation there. This page will show the
            graded scorecard after Vapi posts the end-of-call report
            {session.vapiCallId ? ` (call id ${session.vapiCallId})` : ""}.
          </p>
          <p className="text-sm text-muted">
            Without <code className="text-xs">VAPI_API_KEY</code>, voice sessions auto-complete in demo
            mode. Refresh after the call ends if the scorecard does not appear automatically.
          </p>
          {messages.length > 0 && (
            <div className="mt-4">
              <TranscriptView
                segments={messages.map((m) => ({
                  speaker: m.role,
                  startSec: m.atMs / 1000,
                  endSec: m.atMs / 1000 + 2,
                  text: m.text,
                }))}
                repName={user.name}
                prospectName={persona.name}
              />
            </div>
          )}
        </Card>
      </div>
    );
  }

  // --- ACTIVE, owned by the current user: live chat ---
  if (session.status === "ACTIVE" && isOwner) {
    return (
      <div>
        <PageHeader
          title={session.scenario.title}
          subtitle="You are the rep, the AI is the prospect — start with your opener."
          actions={<StatusPill status={session.status} />}
        />
        {briefing}
        <RoleplayChat
          sessionId={session.id}
          initialMessages={messages}
          personaName={persona.name}
          repName={user.name}
          startedAtIso={session.startedAt.toISOString()}
        />
      </div>
    );
  }

  // --- ACTIVE, viewed by someone else (a manager): read-only ---
  if (session.status === "ACTIVE") {
    return (
      <div>
        <PageHeader
          title={session.scenario.title}
          subtitle={`${session.rep.name} started this session ${fmtDateTime(session.startedAt)}.`}
          actions={<StatusPill status={session.status} />}
        />
        {briefing}
        <Card>
          <EmptyState
            title="Session in progress"
            hint={`${session.rep.name} is still in this role-play. The transcript and grade will appear here once they finish.`}
          />
        </Card>
      </div>
    );
  }

  // --- COMPLETED / GRADED: transcript + grade ---
  const segments: TranscriptSegment[] = messages.map((m) => ({
    speaker: m.role,
    startSec: m.atMs / 1000,
    endSec: m.atMs / 1000,
    text: m.text,
  }));

  return (
    <div>
      <PageHeader
        title={session.scenario.title}
        subtitle={`${session.rep.name} · ${fmtDateTime(session.startedAt)} · ${fmtDuration(session.durationSec)} · ${session.mode === "VOICE" ? "Voice" : "Text"} role-play`}
        actions={
          <div className="flex items-center gap-3">
            <StatusPill status={session.status} />
            <Link href="/roleplay" className="text-sm text-muted hover:text-foreground transition-colors">
              Back to sessions
            </Link>
          </div>
        }
      />
      {briefing}

      <div className="space-y-6">
        {session.status === "COMPLETED" && !session.grade && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted">
                This session ended without being graded. Run it through the grading engine to get the scorecard.
              </p>
              <GradeSessionButton sessionId={session.id} />
            </div>
          </Card>
        )}

        {segments.length > 0 ? (
          <TranscriptView segments={segments} repName={session.rep.name} prospectName={persona.name} />
        ) : (
          <Card>
            <EmptyState title="No transcript" hint="This session ended before any messages were exchanged." />
          </Card>
        )}

        {session.grade && <GradeView grade={session.grade} />}
      </div>
    </div>
  );
}
