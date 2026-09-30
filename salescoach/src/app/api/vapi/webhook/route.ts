import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gradeRoleplay } from "@/lib/pipeline";
import type { RoleplayMessage } from "@/lib/types";

// Voice-mode ingestion for Vapi (https://vapi.ai) end-of-call reports.
//
// Flow (future iteration): the UI initiates a voice role-play, creates a
// RoleplaySession with mode VOICE and the Vapi call id stored in vapiCallId,
// and the rep talks to the AI prospect over the phone/browser. When the call
// ends, Vapi POSTs an end-of-call-report here; we attach the transcript to the
// waiting session and grade it through the same pipeline as text sessions.
//
// This endpoint is production-shaped but not exercised in the demo: no UI
// currently creates VOICE sessions, so lookups by vapiCallId will 404.

interface VapiArtifactMessage {
  role: "user" | "assistant" | "bot" | string; // Vapi uses "bot" in some payload versions
  message: string;
  secondsFromStart?: number;
}

interface VapiEndOfCallReport {
  message?: {
    type?: string;
    call?: { id?: string };
    artifact?: { messages?: VapiArtifactMessage[] };
  };
}

export async function POST(req: Request) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) {
    // Voice mode is opt-in; without the secret configured the feature is off.
    return NextResponse.json({ error: "Voice role-play is not configured" }, { status: 503 });
  }
  if (req.headers.get("x-vapi-secret") !== secret) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => ({}))) as VapiEndOfCallReport;
  const message = payload.message;

  // Vapi sends many event types over one webhook; we only ingest final reports.
  if (message?.type !== "end-of-call-report") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const callId = message.call?.id;
  if (!callId) {
    return NextResponse.json({ error: "Missing call.id in end-of-call-report" }, { status: 400 });
  }

  // Voice sessions are created with vapiCallId when initiated from the UI in a
  // future iteration; a missing session means the call is not one of ours.
  const session = await db.roleplaySession.findFirst({ where: { vapiCallId: callId } });
  if (!session) {
    return NextResponse.json({ error: "No role-play session for this call" }, { status: 404 });
  }

  const artifactMessages = message.artifact?.messages ?? [];
  const messages: RoleplayMessage[] = artifactMessages
    .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "bot")
    .map((m, i) => ({
      // In Vapi's frame the assistant/bot is our AI prospect; "user" is the rep.
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
      messagesJson: JSON.stringify(messages),
      durationSec: Math.round(lastAtMs / 1000),
      endedAt: new Date(),
    },
  });

  await gradeRoleplay(session.id);

  return NextResponse.json({ ok: true });
}
