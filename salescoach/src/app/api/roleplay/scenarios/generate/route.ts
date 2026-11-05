import { NextResponse } from "next/server";
import { aiAvailable, chatJSON } from "@/lib/ai";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { parseCompanyProfile, type ScenarioPersona } from "@/lib/types";

// Build a draft scenario from the org's company profile so a trainer can go
// from "we onboarded our company context" to "reps have something realistic
// to practice against" in one click. Deterministic assembly always works;
// with an API key the personality and notes are sharpened by the LLM.

export interface ScenarioDraft {
  title: string;
  callType: string;
  difficulty: string;
  persona: ScenarioPersona;
  winConditions: string[];
}

const PERSONA_NAMES = [
  "Dana Whitfield",
  "Marcus Chen",
  "Priya Raman",
  "Tom Alvarez",
  "Elena Petrova",
  "Jordan Blake",
];

const COMPANY_NAMES = [
  "Northgate Distribution",
  "Harbor Supply Co.",
  "Crestline Wholesale",
  "Bluepeak Logistics",
  "Summit Trade Partners",
  "Ironwood Goods",
];

export async function GET() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Only managers and trainers can generate scenarios" }, { status: 403 });
  }

  const context = await db.companyContext.findUnique({ where: { orgId: user.orgId } });
  const profile = parseCompanyProfile(context?.profileJson ?? "{}");
  if (profile.personas.length === 0) {
    return NextResponse.json(
      { error: "Add buyer personas to the company profile before generating a scenario" },
      { status: 422 },
    );
  }

  // Rotate through the profile's personas so repeated clicks cover the whole
  // buying committee instead of always drafting the same one.
  const scenarioCount = await db.scenario.count({ where: { orgId: user.orgId } });
  const buyer = profile.personas[scenarioCount % profile.personas.length];
  const name = PERSONA_NAMES[scenarioCount % PERSONA_NAMES.length];
  const company = COMPANY_NAMES[scenarioCount % COMPANY_NAMES.length];

  const objections = profile.objections.slice(0, 2).map((o) => o.objection);
  const competitor = profile.competitors[scenarioCount % Math.max(1, profile.competitors.length)];

  const notesParts = [buyer.notes];
  if (competitor) {
    notesParts.push(`They are also looking at ${competitor.name}. Positioning reminder: ${competitor.positioning}`);
  }

  let personality =
    "Professional and busy. Neutral to mildly skeptical; answers direct questions honestly but does not volunteer information.";
  let notes = notesParts.filter(Boolean).join(" ");

  // LLM enrichment: sharpen the personality and notes. Any failure falls back
  // to the deterministic draft above.
  if (aiAvailable()) {
    try {
      const enriched = await chatJSON<{ personality?: string; notes?: string }>(
        [
          "You write sales role-play prospect personas. Given a buyer persona and context,",
          "return JSON with two string fields:",
          `"personality": 1-2 sentences of vivid, specific temperament for an actor to play (tone, pace, quirks),`,
          `"notes": 1-3 sentences of situational context the prospect knows (current tooling, competitor pressure, internal politics).`,
          "Ground everything in the provided facts. No markdown.",
        ].join(" "),
        JSON.stringify({
          buyerTitle: buyer.title,
          industry: buyer.industry,
          painPoints: buyer.painPoints,
          buyerNotes: buyer.notes,
          objections,
          competitor: competitor ? { name: competitor.name, positioning: competitor.positioning } : null,
          sellerDescription: profile.description,
        }),
      );
      if (enriched.personality?.trim()) personality = enriched.personality.trim();
      if (enriched.notes?.trim()) notes = enriched.notes.trim();
    } catch {
      // Keep the deterministic draft.
    }
  }

  const draft: ScenarioDraft = {
    title: `Practice: ${buyer.title} discovery`,
    callType: "discovery",
    difficulty: "medium",
    persona: {
      name,
      title: buyer.title,
      company,
      industry: buyer.industry,
      personality,
      painPoints: buyer.painPoints,
      objections,
      budget: profile.pricingNotes
        ? "Has budget authority but will not discuss numbers until value is quantified."
        : "Guarded about budget; needs a business case first.",
      notes,
    },
    winConditions: [
      "Surface at least two of the persona's pain points through discovery questions",
      ...(objections[0] ? [`Handle the "${objections[0]}" objection with the approved response`] : []),
      "Quantify the cost of the problem before discussing price",
      "Secure a concrete next step with a date and named attendees",
    ],
  };

  return NextResponse.json(draft);
}
