import type { ProspectAttitude, ProspectInterest, ScenarioPersona } from "./types";
import { ATTITUDE_VALUES, CALL_TYPE_VALUES, DIFFICULTY_VALUES, VOICE_VALUES } from "./scenario-options";

// Validates and normalizes a scenario payload from the builder / editor.
// Returns either a clean record ready for Prisma or a user-facing error.

export interface ScenarioInput {
  title?: unknown;
  callType?: unknown;
  difficulty?: unknown;
  persona?: Partial<Record<keyof ScenarioPersona, unknown>>;
  winConditions?: unknown;
}

export interface NormalizedScenario {
  title: string;
  callType: string;
  difficulty: string;
  persona: ScenarioPersona;
  winConditions: string[];
}

const MAX_SHORT = 200;
const MAX_LONG = 1500;
const MAX_LIST = 12;

const str = (v: unknown, max = MAX_SHORT) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strList = (v: unknown, max = MAX_LIST) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 400)).filter(Boolean).slice(0, max) : [];

export function normalizeScenario(body: ScenarioInput): { ok: true; value: NormalizedScenario } | { ok: false; error: string } {
  const title = str(body.title);
  if (!title) return { ok: false, error: "Give the scenario a title." };

  const p = body.persona ?? {};
  const name = str(p.name);
  if (!name) return { ok: false, error: "The prospect needs a name." };

  const attitude = str(p.attitude);
  const interest = str(p.interest);
  const voice = str(p.voice);
  const sourceUrl = str(p.sourceUrl, 500);

  const persona: ScenarioPersona = {
    name,
    title: str(p.title),
    company: str(p.company),
    industry: str(p.industry),
    personality: str(p.personality, MAX_LONG),
    painPoints: strList(p.painPoints),
    objections: strList(p.objections),
    budget: str(p.budget, 400),
    notes: str(p.notes, MAX_LONG),
    ...(ATTITUDE_VALUES.includes(attitude) ? { attitude: attitude as ProspectAttitude } : {}),
    ...(["low", "medium", "high"].includes(interest) ? { interest: interest as ProspectInterest } : {}),
    ...(strList(p.priorities).length ? { priorities: strList(p.priorities) } : {}),
    ...(str(p.businessSize) ? { businessSize: str(p.businessSize) } : {}),
    ...(str(p.authority, 400) ? { authority: str(p.authority, 400) } : {}),
    ...(str(p.offering, 600) ? { offering: str(p.offering, 600) } : {}),
    ...(str(p.objective, 400) ? { objective: str(p.objective, 400) } : {}),
    ...(str(p.situation, MAX_LONG) ? { situation: str(p.situation, MAX_LONG) } : {}),
    ...(strList(p.facts).length ? { facts: strList(p.facts) } : {}),
    ...(strList(p.assumptions).length ? { assumptions: strList(p.assumptions) } : {}),
    ...(/^https?:\/\//i.test(sourceUrl) ? { sourceUrl } : {}),
    ...(VOICE_VALUES.includes(voice) ? { voice } : {}),
  };

  const callType = str(body.callType);
  const difficulty = str(body.difficulty);
  return {
    ok: true,
    value: {
      title,
      callType: CALL_TYPE_VALUES.includes(callType) ? callType : "discovery",
      difficulty: DIFFICULTY_VALUES.includes(difficulty) ? difficulty : "medium",
      persona,
      winConditions: strList(body.winConditions, 8),
    },
  };
}
