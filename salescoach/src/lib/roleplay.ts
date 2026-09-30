import { aiAvailable, chatText } from "./ai";
import { parseCompanyProfile, parsePersona, type RoleplayMessage, type ScenarioPersona } from "./types";
import { db } from "./db";

// The AI prospect. With an API key the persona is played by the LLM, grounded
// in the scenario persona + the org's company context (so it raises the
// customer's real objections). Without a key, a scripted engine keeps the
// text role-play flow fully demoable.

export async function prospectReply(sessionId: string, history: RoleplayMessage[]): Promise<string> {
  const session = await db.roleplaySession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { scenario: true, org: { include: { companyContext: true } } },
  });
  const persona = parsePersona(session.scenario.personaJson);

  if (!aiAvailable()) return scriptedReply(persona, history);

  const company = parseCompanyProfile(session.org.companyContext?.profileJson ?? "{}");
  const system = [
    `You are role-playing a sales prospect so a sales rep can practice. Stay in character no matter what.`,
    `You are ${persona.name}, ${persona.title} at ${persona.company}, a company in the ${persona.industry} industry.`,
    `Personality: ${persona.personality}.`,
    `Your real pain points (reveal them only if the rep earns it with good discovery): ${persona.painPoints.join("; ")}.`,
    `Objections you should raise naturally during the conversation: ${persona.objections.join("; ")}.`,
    persona.budget ? `Budget posture: ${persona.budget}.` : "",
    persona.notes ? `Additional context: ${persona.notes}.` : "",
    company.description ? `The rep sells for this company: ${company.description}` : "",
    `Difficulty: ${session.scenario.difficulty}. ${difficultyGuidance(session.scenario.difficulty)}`,
    `Rules: sound like a real person on a phone call — short conversational turns (1-3 sentences), occasional skepticism, never volunteer everything at once, never break character, never mention being an AI. If the rep is doing badly, act like a real busy prospect would (get short, try to end the call).`,
  ]
    .filter(Boolean)
    .join("\n");

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
