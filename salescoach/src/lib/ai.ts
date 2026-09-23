import OpenAI from "openai";

// Single LLM entry point. When OPENAI_API_KEY is unset the platform runs in
// mock mode: grading falls back to a deterministic heuristic grader and the
// role-play prospect uses a scripted engine, so every flow stays demoable.

export const AI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

let client: OpenAI | null = null;

export function aiAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export async function chatJSON<T>(system: string, user: string): Promise<T> {
  const res = await getClient().chat.completions.create({
    model: AI_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = res.choices[0]?.message?.content ?? "{}";
  return JSON.parse(content) as T;
}

export async function chatText(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const res = await getClient().chat.completions.create({
    model: AI_MODEL,
    temperature: 0.8,
    messages: [{ role: "system" as const, content: system }, ...messages],
  });
  return res.choices[0]?.message?.content ?? "";
}
