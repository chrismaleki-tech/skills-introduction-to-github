import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gradeRoleplay } from "@/lib/pipeline";
import { enqueueJob, inlineJobs } from "@/lib/queue";
import { recordUsage } from "@/lib/metering";
import type { RoleplayMessage } from "@/lib/types";

// Voice-mode ingestion for Vapi (https://vapi.ai) end-of-call reports.
// UI creates RoleplaySession with mode=VOICE and real vapiCallId when
// VAPI_API_KEY is set; this webhook attaches the transcript and grades it.

interface VapiArtifactMessage {
  role: "user" | "assistant" | "bot" | string;
  message: string;
  secondsFromStart?: number;
}

interface VapiEndOfCallReport {
  message?: {
    type?: string;
    call?: { id?: string; metadata?: { salescoachSessionId?: string } };
    artifact?: { messages?: VapiArtifactMessage[] };
  };
}

export async function POST(req: Request) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Voice role-play is not configured" }, { status: 503 });
  }
  if (req.headers.get("x-vapi-secret") !== secret) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => ({}))) as VapiEndOfCallReport;
  const message = payload.message;

  if (message?.type !== "end-of-call-report") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const callId = message.call?.id;
  const metaSessionId = message.call?.metadata?.salescoachSessionId;
  if (!callId && !metaSessionId) {
    return NextResponse.json({ error: "Missing call.id in end-of-call-report" }, { status: 400 });
  }

  const session =
    (callId
      ? await db.roleplaySession.findFirst({ where: { vapiCallId: callId } })
      : null) ??
    (metaSessionId
      ? await db.roleplaySession.findFirst({ where: { id: metaSessionId, mode: "VOICE" } })
      : null);

  if (!session) {
    return NextResponse.json({ error: "No role-play session for this call" }, { status: 404 });
  }

  const artifactMessages = message.artifact?.messages ?? [];
  const messages: RoleplayMessage[] = artifactMessages
    .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "bot")
    .map((m, i) => ({
      role: m.role === "user" ? ("rep" as const) : ("prospect" as const),
      text: m.message,
      atMs: Math.round((m.secondsFromStart ?? i * 5) * 1000),
    }));

  const lastAtMs = messages.length ? messages[messages.length - 1].atMs : 0;
  await db.roleplaySession.update({
    where: { id: session.id },
    data: {
      mode: "VOICE",
      status: "COMPLETED",
      vapiCallId: callId || session.vapiCallId,
      messagesJson: JSON.stringify(messages),
      durationSec: Math.round(lastAtMs / 1000),
      endedAt: new Date(),
    },
  });

  if (inlineJobs()) {
    await gradeRoleplay(session.id);
  } else {
    await enqueueJob({
      orgId: session.orgId,
      type: "GRADE_ROLEPLAY",
      payload: { roleplayId: session.id },
    });
  }

  await recordUsage({
    orgId: session.orgId,
    type: "ROLEPLAY_GRADED",
    userId: session.repId,
    subjectType: "ROLEPLAY",
    subjectId: session.id,
    meta: { source: "vapi" },
  });

  return NextResponse.json({ ok: true, sessionId: session.id });
}
