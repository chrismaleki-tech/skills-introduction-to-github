import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prospectReply } from "@/lib/roleplay";
import { currentUser } from "@/lib/session";
import { parseMessages, type RoleplayMessage } from "@/lib/types";

const MAX_MESSAGE_CHARS = 2000;

// Rep sends a message; the AI prospect replies. Both turns are appended to the
// session transcript. If the prospect engine fails, the rep's message is still
// persisted so nothing typed is lost.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();

  const session = await db.roleplaySession.findUnique({ where: { id } });
  if (!session || session.orgId !== user.orgId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.repId !== user.id) {
    return NextResponse.json({ error: "Only the session owner can send messages" }, { status: 403 });
  }
  if (session.status !== "ACTIVE") {
    return NextResponse.json({ error: "Session is no longer active" }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Message text required" }, { status: 400 });
  if (text.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_MESSAGE_CHARS} characters)` },
      { status: 400 },
    );
  }

  const atMs = Date.now() - session.startedAt.getTime();
  const repMessage: RoleplayMessage = { role: "rep", text, atMs };
  const history = [...parseMessages(session.messagesJson), repMessage];

  // Persist the rep turn before calling the prospect engine.
  await db.roleplaySession.update({
    where: { id },
    data: {
      messagesJson: JSON.stringify(history),
      durationSec: Math.round(atMs / 1000),
    },
  });

  let reply: string;
  try {
    reply = await prospectReply(id, history);
  } catch {
    return NextResponse.json(
      { error: "The prospect engine failed to reply. Your message was saved — try sending again." },
      { status: 502 },
    );
  }

  const replyAtMs = Date.now() - session.startedAt.getTime();
  const prospectMessage: RoleplayMessage = { role: "prospect", text: reply, atMs: replyAtMs };
  await db.roleplaySession.update({
    where: { id },
    data: {
      messagesJson: JSON.stringify([...history, prospectMessage]),
      durationSec: Math.round(replyAtMs / 1000),
    },
  });

  return NextResponse.json({ reply });
}
