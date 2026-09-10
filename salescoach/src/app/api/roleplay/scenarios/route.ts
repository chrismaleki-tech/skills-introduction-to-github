import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import type { ScenarioPersona } from "@/lib/types";

interface CreateScenarioBody {
  title?: string;
  callType?: string;
  difficulty?: string;
  persona?: Partial<ScenarioPersona>;
  winConditions?: string[];
}

const CALL_TYPES = ["cold_call", "discovery", "demo", "negotiation", "renewal"];
const DIFFICULTIES = ["easy", "medium", "hard"];

// Create a scenario (managers and trainers only).
export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only managers and trainers can create scenarios" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateScenarioBody;
  const title = (body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const p = body.persona ?? {};
  const persona: ScenarioPersona = {
    name: (p.name ?? "").trim(),
    title: (p.title ?? "").trim(),
    company: (p.company ?? "").trim(),
    industry: (p.industry ?? "").trim(),
    personality: (p.personality ?? "").trim(),
    painPoints: (p.painPoints ?? []).map((s) => s.trim()).filter(Boolean),
    objections: (p.objections ?? []).map((s) => s.trim()).filter(Boolean),
    budget: (p.budget ?? "").trim(),
    notes: (p.notes ?? "").trim(),
  };
  if (!persona.name) return NextResponse.json({ error: "Persona name required" }, { status: 400 });

  const scenario = await db.scenario.create({
    data: {
      orgId: user.orgId,
      title,
      callType: CALL_TYPES.includes(body.callType ?? "") ? body.callType! : "discovery",
      difficulty: DIFFICULTIES.includes(body.difficulty ?? "") ? body.difficulty! : "medium",
      personaJson: JSON.stringify(persona),
      winConditionsJson: JSON.stringify((body.winConditions ?? []).map((s) => s.trim()).filter(Boolean)),
      methodologyId: user.org.activeMethodologyId,
    },
  });

  return NextResponse.json({ id: scenario.id });
}
