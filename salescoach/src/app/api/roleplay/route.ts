import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { enqueueJob, inlineJobs } from "@/lib/queue";
import { gradeRoleplay } from "@/lib/pipeline";
import { createVapiWebCall, vapiConfigured } from "@/lib/vapi";
import { recordUsage } from "@/lib/metering";
import { parsePersona, parseStringArray } from "@/lib/types";

// Start a text or voice role-play session against a scenario.
export async function POST(req: Request) {
  const user = await currentUser();
  const body = (await req.json().catch(() => ({}))) as {
    scenarioId?: string;
    mode?: "TEXT" | "VOICE";
  };
  if (!body.scenarioId) {
    return NextResponse.json({ error: "scenarioId required" }, { status: 400 });
  }

  const scenario = await db.scenario.findUnique({ where: { id: body.scenarioId } });
  if (!scenario || scenario.orgId !== user.orgId) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }

  const mode = body.mode === "VOICE" ? "VOICE" : "TEXT";
  const liveVoice = mode === "VOICE" && vapiConfigured();

  const session = await db.roleplaySession.create({
    data: {
      orgId: user.orgId,
      repId: user.id,
      scenarioId: scenario.id,
      mode,
      status: "ACTIVE",
      messagesJson: "[]",
      vapiCallId: null,
    },
  });

  if (mode === "VOICE" && !liveVoice) {
    // Demo path: synthesize a short voice transcript and grade it so the UI
    // is fully usable without Vapi credentials.
    const demoMessages = [
      { role: "rep", text: "Thanks for taking my call — what's the biggest inventory pain right now?", atMs: 0 },
      {
        role: "prospect",
        text: "Count drift across warehouses. We shorted a retail account last quarter.",
        atMs: 8000,
      },
      {
        role: "rep",
        text: "Roughly what did those shorts cost you? Our phased rollout gets the first warehouse live in six weeks.",
        atMs: 16000,
      },
      {
        role: "prospect",
        text: "Chargebacks alone were forty thousand. Send me a payback model and we can meet with my CFO.",
        atMs: 28000,
      },
    ];
    await db.roleplaySession.update({
      where: { id: session.id },
      data: {
        messagesJson: JSON.stringify(demoMessages),
        status: "COMPLETED",
        endedAt: new Date(),
        durationSec: 90,
        vapiCallId: `demo-voice-${session.id}`,
      },
    });
    if (inlineJobs()) {
      await gradeRoleplay(session.id);
    } else {
      await enqueueJob({
        orgId: user.orgId,
        type: "GRADE_ROLEPLAY",
        payload: { roleplayId: session.id },
      });
    }
    await recordUsage({
      orgId: user.orgId,
      type: "VOICE_SESSION",
      userId: user.id,
      subjectType: "ROLEPLAY",
      subjectId: session.id,
      meta: { demo: true },
    });
    return NextResponse.json({
      id: session.id,
      mode: "VOICE",
      demoCompleted: true,
      message: "Demo voice session completed and queued for grading (no VAPI_API_KEY).",
    });
  }

  if (liveVoice) {
    try {
      const persona = parsePersona(scenario.personaJson);
      const win = parseStringArray(scenario.winConditionsJson);
      const personaLabel = [persona.name, persona.title, persona.company, scenario.difficulty]
        .filter(Boolean)
        .join(" · ");
      const systemPrompt = [
        `You are ${persona.name || "a sales prospect"}${persona.title ? `, ${persona.title}` : ""}${persona.company ? ` at ${persona.company}` : ""}.`,
        persona.personality || "",
        persona.painPoints?.length ? `Pain points: ${persona.painPoints.join("; ")}` : "",
        persona.objections?.length ? `Likely objections: ${persona.objections.join("; ")}` : "",
        win.length ? `Win conditions the rep is chasing (resist until earned): ${win.join("; ")}` : "",
        "Stay in character. Push back realistically. Be concise on a phone call.",
      ]
        .filter(Boolean)
        .join("\n");

      const vapi = await createVapiWebCall({
        sessionId: session.id,
        prospectName: persona.name || "Prospect",
        prospectPersona: personaLabel,
        systemPrompt,
        firstMessage: `Hi, this is ${persona.name || "the prospect"}. What are you calling about?`,
      });

      await db.roleplaySession.update({
        where: { id: session.id },
        data: { vapiCallId: vapi.callId },
      });
      await recordUsage({
        orgId: user.orgId,
        type: "VOICE_SESSION",
        userId: user.id,
        subjectType: "ROLEPLAY",
        subjectId: session.id,
        meta: { demo: false, vapiCallId: vapi.callId },
      });

      return NextResponse.json({
        id: session.id,
        mode: "VOICE",
        vapiCallId: vapi.callId,
        vapiJoinUrl: vapi.joinUrl,
        message: vapi.joinUrl
          ? "Voice session created — open the join URL to talk to the AI prospect."
          : "Voice session created — complete the call in Vapi; webhook will grade on end-of-call.",
      });
    } catch (err) {
      await db.roleplaySession.update({
        where: { id: session.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to create Vapi call." },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({
    id: session.id,
    mode,
  });
}
