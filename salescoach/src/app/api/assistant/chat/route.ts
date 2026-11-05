import { NextResponse } from "next/server";
import { runAssistantChat, type ChatMessage } from "@/lib/assistant";
import { currentUser, isManagerRole } from "@/lib/session";

export async function POST(req: Request) {
  const user = await currentUser();
  const body = (await req.json().catch(() => null)) as {
    message?: string;
    history?: ChatMessage[];
  } | null;

  const message = body?.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }

  try {
    const result = await runAssistantChat({
      message,
      history: Array.isArray(body?.history) ? body!.history!.slice(-8) : [],
      orgId: user.orgId,
      userId: user.id,
      role: user.role,
      isManager: isManagerRole(user.role),
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("assistant chat failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Assistant failed." },
      { status: 500 },
    );
  }
}
