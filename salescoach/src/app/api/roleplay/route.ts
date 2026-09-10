import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { enqueueJob, inlineJobs } from "@/lib/queue";
import { gradeRoleplay } from "@/lib/pipeline";

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
  const vapiConfigured = Boolean(process.env.VAPI_API_KEY);

  const session = await db.roleplaySession.create({
    data: {
      orgId: user.orgId,
      repId: user.id,
      scenarioId: scenario.id,
      mode,
      status: mode === "VOICE" ? "ACTIVE" : "ACTIVE",
      messagesJson: "[]",
      vapiCallId: mode === "VOICE" ? `demo-voice-${Date.now()}` : null,
    },
  });

  if (mode === "VOICE" && !vapiConfigured) {
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
    return NextResponse.json({
      id: session.id,
      mode: "VOICE",
      demoCompleted: true,
      message: "Demo voice session completed and queued for grading (no VAPI_API_KEY).",
    });
  }

  return NextResponse.json({
    id: session.id,
    mode,
    vapiJoinUrl: mode === "VOICE" && vapiConfigured ? null : undefined,
  });
}
