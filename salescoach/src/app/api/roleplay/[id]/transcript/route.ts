import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { parseMessages, type RoleplayMessage } from "@/lib/types";
import { meterRoleplaySession, roleplayCutoffMessage } from "@/lib/usage";

// Voice sessions run peer-to-peer between the browser and OpenAI, so the
// browser is the only party holding the transcript. It posts snapshots here
// (periodically and on end) so the session can be graded like a text one.
// Snapshots are whole-transcript: the server keeps whichever copy is longer,
// so an out-of-order or shorter snapshot cannot truncate the record.
//
// Every post is also a liveness heartbeat: the time since the previous one
// (capped) is charged against the AI Role Play allowance. When the allowance
// runs out or the trial expires, the transcript is still saved, the session
// is completed server-side, and the response says why (HTTP 402) so the
// browser can hang up and grade what it has.
const MAX_MESSAGES = 400;
const MAX_MESSAGE_CHARS = 4000;

type IncomingMessage = { role?: unknown; text?: unknown; atMs?: unknown };

function normalize(raw: unknown): RoleplayMessage[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_MESSAGES) return null;
  const out: RoleplayMessage[] = [];
  for (const item of raw as IncomingMessage[]) {
    if (!item || (item.role !== "rep" && item.role !== "prospect")) return null;
    if (typeof item.text !== "string") return null;
    const text = item.text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!text) continue;
    const atMs = typeof item.atMs === "number" && Number.isFinite(item.atMs) ? Math.max(0, Math.round(item.atMs)) : 0;
    out.push({ role: item.role, text, atMs });
  }
  return out;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();

  const session = await db.roleplaySession.findUnique({
    where: { id },
    include: { grade: { select: { id: true } } },
  });
  if (!session || session.orgId !== user.orgId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.repId !== user.id) {
    return NextResponse.json({ error: "Only the session owner can update the transcript" }, { status: 403 });
  }
  // A session the server ended (allowance or trial) stays writable until it
  // is graded, so the browser's final snapshot is not lost.
  if ((session.status !== "ACTIVE" && session.status !== "COMPLETED") || session.grade) {
    return NextResponse.json({ error: "Session is no longer active" }, { status: 409 });
  }
  if (session.mode !== "VOICE") {
    return NextResponse.json({ error: "Transcript sync is only for voice sessions" }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as { messages?: unknown; switchToText?: unknown };
  const incoming = body.messages === undefined ? [] : normalize(body.messages);
  if (!incoming) return NextResponse.json({ error: "messages must be an array of transcript turns" }, { status: 400 });

  const existing = parseMessages(session.messagesJson);
  const merged = incoming.length >= existing.length ? incoming : existing;

  await db.roleplaySession.update({
    where: { id },
    data: {
      messagesJson: JSON.stringify(merged),
      // The rep can fall back to typing mid-session (no mic, noisy room);
      // persisting the switch keeps the chat UI on reload.
      ...(body.switchToText === true ? { mode: "TEXT" } : {}),
    },
  });

  const saved = { saved: merged.length, repTurns: merged.filter((m) => m.role === "rep").length };
  if (session.status !== "ACTIVE") {
    return NextResponse.json({ ...saved, status: session.status, durationSec: session.durationSec });
  }

  const meter = await meterRoleplaySession(id);
  const usage = {
    durationSec: meter.durationSec,
    remainingSeconds: meter.remainingSeconds,
    limitSeconds: meter.limitSeconds,
    basis: meter.basis,
    status: meter.status,
  };
  if (meter.endedReason) {
    return NextResponse.json(
      {
        ...saved,
        ...usage,
        ended: meter.endedReason,
        ...roleplayCutoffMessage(meter.endedReason),
        billingUrl: "/billing",
      },
      { status: 402 },
    );
  }
  return NextResponse.json({ ...saved, ...usage });
}
