/**
 * Vapi voice role-play client.
 * Creates a web call when VAPI_API_KEY is set; returns join URL for the UI.
 */

export type VapiCreateResult = {
  callId: string;
  joinUrl: string | null;
};

export function vapiConfigured() {
  return Boolean(process.env.VAPI_API_KEY?.trim());
}

export async function createVapiWebCall(input: {
  sessionId: string;
  prospectName: string;
  prospectPersona: string;
  systemPrompt: string;
  firstMessage?: string;
}): Promise<VapiCreateResult> {
  const apiKey = process.env.VAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("VAPI_API_KEY is not configured.");
  }

  const assistantId = process.env.VAPI_ASSISTANT_ID?.trim();
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
  const serverUrl = process.env.VAPI_SERVER_URL?.trim() || process.env.APP_BASE_URL?.trim();

  // Prefer transient assistant config so each scenario gets its own persona.
  const body: Record<string, unknown> = {
    name: `SalesCoach role-play ${input.sessionId}`,
    assistant: assistantId
      ? { assistantId }
      : {
          name: input.prospectName || "AI Prospect",
          firstMessage:
            input.firstMessage ||
            `Hello, this is ${input.prospectName || "the prospect"}. What can I do for you?`,
          model: {
            provider: "openai",
            model: process.env.VAPI_MODEL || "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  input.systemPrompt ||
                  `You are ${input.prospectName}, a sales prospect. Persona: ${input.prospectPersona}. Stay in character. Be concise.`,
              },
            ],
          },
          voice: {
            provider: "11labs",
            voiceId: process.env.VAPI_VOICE_ID || "rachel",
          },
        },
    metadata: {
      salescoachSessionId: input.sessionId,
    },
  };

  if (serverUrl) {
    body.serverUrl = `${serverUrl.replace(/\/$/, "")}/api/vapi/webhook`;
    if (process.env.VAPI_WEBHOOK_SECRET) {
      body.serverUrlSecret = process.env.VAPI_WEBHOOK_SECRET;
    }
  }

  // Web call (browser) — no phoneNumberId required.
  if (phoneNumberId) {
    body.phoneNumberId = phoneNumberId;
  }

  const res = await fetch("https://api.vapi.ai/call/web", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Fallback: some accounts use POST /call with type webCall
    const fallback = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, type: "webCall" }),
    });
    if (!fallback.ok) {
      const errText = await res.text().catch(() => "");
      const errText2 = await fallback.text().catch(() => "");
      throw new Error(
        `Vapi call create failed (${res.status}/${fallback.status}): ${(errText || errText2).slice(0, 300)}`,
      );
    }
    const data = (await fallback.json()) as {
      id?: string;
      webCallUrl?: string;
      monitor?: { listenUrl?: string; controlUrl?: string };
    };
    return {
      callId: data.id || `vapi-${input.sessionId}`,
      joinUrl: data.webCallUrl || data.monitor?.listenUrl || null,
    };
  }

  const data = (await res.json()) as {
    id?: string;
    webCallUrl?: string;
    monitor?: { listenUrl?: string };
  };
  return {
    callId: data.id || `vapi-${input.sessionId}`,
    joinUrl: data.webCallUrl || data.monitor?.listenUrl || null,
  };
}
