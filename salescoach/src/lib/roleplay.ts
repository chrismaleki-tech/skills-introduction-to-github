import { aiAvailable, chatText } from "./ai";
import { parseCompanyProfile, parsePersona, type RoleplayMessage, type ScenarioPersona } from "./types";
import { db } from "./db";

// The AI prospect. With an API key the persona is played by the LLM, grounded
// in the scenario persona + the org's company context (so it raises the
// customer's real objections). The same persona prompt drives both the text
// chat (chat completions) and the live voice call (OpenAI Realtime). Without
// a key, a scripted engine keeps the text role-play flow fully demoable.

export type ProspectPromptInput = {
  persona: ScenarioPersona;
  difficulty: string;
  callType: string;
  companyDescription?: string;
};

export function buildProspectSystemPrompt(input: ProspectPromptInput, channel: "text" | "voice"): string {
  const { persona, difficulty, callType, companyDescription } = input;
  return [
    `You are role-playing a sales prospect so a sales rep can practice. Stay in character no matter what.`,
    `You are ${persona.name}, ${persona.title} at ${persona.company}, a company in the ${persona.industry} industry.`,
    `Personality: ${persona.personality}.`,
    `Your real pain points (reveal them only if the rep earns it with good discovery): ${persona.painPoints.join("; ")}.`,
    `Objections you should raise naturally during the conversation: ${persona.objections.join("; ")}.`,
    persona.budget ? `Budget posture: ${persona.budget}.` : "",
    persona.notes ? `Additional context: ${persona.notes}.` : "",
    companyDescription ? `The rep sells for this company: ${companyDescription}` : "",
    `This is a ${callType.replace(/_/g, " ")} call. The rep is calling you.`,
    `Difficulty: ${difficulty}. ${difficultyGuidance(difficulty)}`,
    `Rules: sound like a real person on a phone call — short conversational turns (1-3 sentences), occasional skepticism, never volunteer everything at once, never break character, never mention being an AI. If the rep is doing badly, act like a real busy prospect would (get short, try to end the call).`,
    channel === "voice"
      ? [
          `Voice rules: you are speaking out loud on a live phone call. Keep every turn brief and natural — one or two sentences, then stop and let the rep talk.`,
          `Use natural spoken cadence (brief pauses, "hm", "right", "okay") and never read out lists, markdown, or formatting.`,
          `When the rep interrupts you, stop and respond to what they said. If the rep is silent for a while, prompt them briefly like a real person would ("You still there?").`,
          `Only speak English unless the rep speaks another language first.`,
        ].join(" ")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// Voice role-play rides on the same OpenAI key as the rest of the AI features.
export function voiceAvailable(): boolean {
  return aiAvailable();
}

export const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime";

const REALTIME_VOICES = ["marin", "cedar", "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"] as const;

// Pick a stable voice per persona so the same prospect always sounds the same.
export function voiceForPersona(persona: ScenarioPersona): string {
  const override = process.env.OPENAI_REALTIME_VOICE;
  if (override) return override;
  let hash = 0;
  for (const ch of `${persona.name}|${persona.company}`) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return REALTIME_VOICES[hash % REALTIME_VOICES.length];
}

export async function prospectReply(sessionId: string, history: RoleplayMessage[]): Promise<string> {
  const session = await db.roleplaySession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { scenario: true, org: { include: { companyContext: true } } },
  });
  const persona = parsePersona(session.scenario.personaJson);

  if (!aiAvailable()) return scriptedReply(persona, history);

  const company = parseCompanyProfile(session.org.companyContext?.profileJson ?? "{}");
  const system = buildProspectSystemPrompt(
    {
      persona,
      difficulty: session.scenario.difficulty,
      callType: session.scenario.callType,
      companyDescription: company.description,
    },
    "text",
  );

  const messages = history.map((m) => ({
    role: m.role === "rep" ? ("user" as const) : ("assistant" as const),
    content: m.text,
  }));
  const reply = await chatText(system, messages);
  return reply.trim() || "Sorry, you cut out for a second — say that again?";
}

function difficultyGuidance(d: string): string {
  if (d === "easy") return "Be reasonably open; raise one objection but let good answers land.";
  if (d === "hard")
    return "Be tough: time-pressed, skeptical, push back on vague claims, raise multiple objections, and only concede next steps to a genuinely strong performance.";
  return "Be realistic: neutral to mildly skeptical, answer direct questions honestly, raise your objections when relevant.";
}

// --- Scripted fallback (no API key) ---

function scriptedReply(persona: ScenarioPersona, history: RoleplayMessage[]): string {
  const repTurns = history.filter((m) => m.role === "rep").length;
  const lastRep = history.filter((m) => m.role === "rep").slice(-1)[0]?.text.toLowerCase() ?? "";

  if (repTurns <= 1) {
    return `This is ${persona.name}. I've got a few minutes — what's this about?`;
  }
  if (lastRep.includes("?")) {
    const pain = persona.painPoints[(repTurns - 2) % Math.max(1, persona.painPoints.length)];
    if (pain && repTurns <= 3) {
      return `Honestly? ${pain}. It's been on my list for a while but we haven't gotten to it.`;
    }
  }
  if (repTurns === 3 && persona.objections[0]) {
    return `Hmm. ${persona.objections[0]}`;
  }
  if (repTurns === 5 && persona.objections[1]) {
    return `Okay, but here's my other issue — ${persona.objections[1]}`;
  }
  if (lastRep.includes("meet") || lastRep.includes("calendar") || lastRep.includes("demo") || lastRep.includes("next step")) {
    return repTurns >= 5
      ? "Alright, send me an invite for later this week and include whatever you'd want me to look at beforehand."
      : "You're moving a little fast — I'd need to understand a lot more before committing time to that.";
  }
  const fillers = [
    "Go on — how does that actually work in practice?",
    "We've looked at things like this before and it never stuck. What makes yours different?",
    "I'm listening, but I've got a hard stop in a few minutes.",
    "And what does something like that cost?",
  ];
  return fillers[repTurns % fillers.length];
}
