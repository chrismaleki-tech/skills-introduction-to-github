import { NextResponse } from "next/server";
import { runAssistantChat, type AssistantSource, type ChatMessage } from "@/lib/assistant";
import { currentUser, isManagerRole } from "@/lib/session";

const DOMAINS = new Set(["all", "crm", "erp", "trainer"]);

export async function POST(req: Request) {
  const user = await currentUser();
  const body = (await req.json().catch(() => null)) as {
    message?: string;
    history?: ChatMessage[];
    domain?: string;
  } | null;

  const message = body?.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }

  const domainRaw = (body?.domain ?? "all").toLowerCase();
  const domain = (DOMAINS.has(domainRaw) ? domainRaw : "all") as "all" | AssistantSource;

  try {
    const result = await runAssistantChat({
      message,
      history: Array.isArray(body?.history) ? body!.history!.slice(-8) : [],
      orgId: user.orgId,
      userId: user.id,
      role: user.role,
      isManager: isManagerRole(user.role),
      domain,
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
