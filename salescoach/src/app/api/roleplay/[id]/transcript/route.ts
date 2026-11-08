import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { parseMessages, type RoleplayMessage } from "@/lib/types";
import { billingError } from "@/lib/billing";
import {
  assertUsageAvailable,
  UsageLimitError,
  usageLimitPayload,
} from "@/lib/usage";

// Voice sessions run peer-to-peer between the browser and OpenAI, so the
// browser is the only party holding the transcript. It posts snapshots here
// (periodically and on end) so the session can be graded like a text one.
// Snapshots are merge-by-position: the server never drops turns it already
// has, so an out-of-order or shorter snapshot cannot truncate the record.
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
  const paymentError = billingError(user.org);
  if (paymentError) return NextResponse.json(paymentError, { status: 402 });

  const session = await db.roleplaySession.findUnique({
    where: { id },
    include: { org: true },
  });
  if (!session || session.orgId !== user.orgId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.repId !== user.id) {
    return NextResponse.json({ error: "Only the session owner can update the transcript" }, { status: 403 });
  }
  if (session.status !== "ACTIVE") {
    return NextResponse.json({ error: "Session is no longer active" }, { status: 409 });
  }
  if (session.mode !== "VOICE") {
    return NextResponse.json({ error: "Transcript sync is only for voice sessions" }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as { messages?: unknown };
  const incoming = normalize(body.messages);
  if (!incoming) return NextResponse.json({ error: "messages must be an array of transcript turns" }, { status: 400 });

  const existing = parseMessages(session.messagesJson);
  const merged = incoming.length >= existing.length ? incoming : existing;

  const nowMs = Date.now() - session.startedAt.getTime();
  const nextDurationSec = Math.max(session.durationSec, Math.round(nowMs / 1000));
  try {
    await assertUsageAvailable(
      session.org,
      session.repId,
      "roleplay",
      Math.max(0, nextDurationSec - session.durationSec),
    );
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return NextResponse.json(usageLimitPayload(error), { status: 402 });
    }
    throw error;
  }

  await db.roleplaySession.update({
    where: { id },
    data: {
      messagesJson: JSON.stringify(merged),
      durationSec: nextDurationSec,
    },
  });

  return NextResponse.json({
    saved: merged.length,
    repTurns: merged.filter((m) => m.role === "rep").length,
  });
}
