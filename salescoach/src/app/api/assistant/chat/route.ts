import { runAssistantChat, type AssistantSource, type ChatMessage } from "@/lib/assistant";
import { currentUser, isManagerRole } from "@/lib/session";

const DOMAINS = new Set(["all", "crm", "erp", "trainer"]);

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function parseBody(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    message?: string;
    history?: ChatMessage[];
    domain?: string;
    stream?: boolean;
  } | null;
  return body;
}

export async function POST(req: Request) {
  const user = await currentUser();
  const body = await parseBody(req);
  const message = body?.message?.trim();
  if (!message) {
    return Response.json({ error: "message is required." }, { status: 400 });
  }

  const domainRaw = (body?.domain ?? "all").toLowerCase();
  const domain = (DOMAINS.has(domainRaw) ? domainRaw : "all") as "all" | AssistantSource;
  const wantsStream =
    body?.stream === true || (req.headers.get("accept") || "").includes("text/event-stream");

  try {
    const result = await runAssistantChat({
      message,
      history: Array.isArray(body?.history) ? body!.history!.slice(-12) : [],
      orgId: user.orgId,
      userId: user.id,
      role: user.role,
      isManager: isManagerRole(user.role),
      domain,
    });

    if (!wantsStream) {
      return Response.json(result);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(sse(event, data)));
        };
        send("meta", {
          links: result.links ?? [],
          sources: result.sources ?? [],
          mode: result.mode,
          data: result.data ?? null,
          followUps: result.followUps ?? [],
        });

        const reply = result.reply || "";
        // Stream word-ish chunks for a progressive feel in demo + LLM modes.
        const chunks = reply.match(/\S+\s*/g) ?? [reply];
        for (const chunk of chunks) {
          send("token", { text: chunk });
          await new Promise((r) => setTimeout(r, 12));
        }
        send("done", { ok: true });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("assistant chat failed", e);
    const error = e instanceof Error ? e.message : "Assistant failed.";
    if (wantsStream) {
      const encoder = new TextEncoder();
      return new Response(encoder.encode(sse("error", { error })), {
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      });
    }
    return Response.json({ error }, { status: 500 });
  }
}
