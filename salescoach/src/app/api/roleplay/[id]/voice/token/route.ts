import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClient } from "@/lib/ai";
import { currentUser } from "@/lib/session";
import { parseCompanyProfile, parsePersona } from "@/lib/types";
import { billingError } from "@/lib/billing";
import {
  buildProspectSystemPrompt,
  REALTIME_MODEL,
  turnDetectionConfig,
  voiceAvailable,
  voiceForPersona,
} from "@/lib/roleplay";
import {
  assertUsageAvailable,
  meterRoleplaySession,
  UsageLimitError,
  usageLimitPayload,
} from "@/lib/usage";

// Mint a short-lived OpenAI Realtime client secret for a live voice role-play.
// The browser uses it to open a WebRTC call directly with OpenAI; the real
// API key never leaves the server. The persona/difficulty/objections are baked
// into the session instructions here so the client cannot alter them.
const TOKEN_TTL_SECONDS = 600;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const paymentError = billingError(user.org);
  if (paymentError) return NextResponse.json(paymentError, { status: 402 });

  const session = await db.roleplaySession.findUnique({
    where: { id },
    include: { scenario: true, org: { include: { companyContext: true } } },
  });
  if (!session || session.orgId !== user.orgId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.repId !== user.id) {
    return NextResponse.json({ error: "Only the session owner can join the call" }, { status: 403 });
  }
  if (session.status !== "ACTIVE") {
    return NextResponse.json({ error: "Session is no longer active" }, { status: 409 });
  }
  if (!voiceAvailable()) {
    return NextResponse.json(
      {
        error:
          "Voice role-play is not configured on this server (OPENAI_API_KEY is missing). Use the text role-play instead.",
        code: "VOICE_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  try {
    await assertUsageAvailable(session.org, session.repId, "roleplay", 0);
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return NextResponse.json(usageLimitPayload(error), { status: 402 });
    }
    throw error;
  }

  const persona = parsePersona(session.scenario.personaJson);
  const company = parseCompanyProfile(session.org.companyContext?.profileJson ?? "{}");
  const instructions = buildProspectSystemPrompt(
    {
      persona,
      difficulty: session.scenario.difficulty,
      callType: session.scenario.callType,
      companyDescription: company.description,
    },
    "voice",
  );
  const voice = voiceForPersona(persona);

  // Metering starts now: the microphone prompt is already behind us and the
  // WebRTC handshake takes a second or two. On a reconnect this also charges
  // the (capped) gap since the last heartbeat of the dropped leg.
  const meter = await meterRoleplaySession(id);
  if (meter.endedReason) {
    return NextResponse.json(
      {
        error:
          meter.endedReason === "trial_expired"
            ? "Your free trial has ended, so this call cannot start. Upgrade to keep practicing."
            : "Your workspace has used all of its AI Role Play minutes, so this call cannot start. Upgrade for more.",
        code: meter.endedReason === "trial_expired" ? "TRIAL_EXPIRED" : "ROLEPLAY_LIMIT_EXCEEDED",
        remainingSeconds: meter.remainingSeconds,
        limitSeconds: meter.limitSeconds,
        billingUrl: "/billing",
      },
      { status: 402 },
    );
  }

  let secret: { value: string; expires_at: number };
  try {
    secret = await getClient().realtime.clientSecrets.create({
      expires_after: { anchor: "created_at", seconds: TOKEN_TTL_SECONDS },
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        instructions,
        output_modalities: ["audio"],
        audio: {
          input: {
            transcription: {
              model: "gpt-4o-mini-transcribe",
              language: "en",
              // Biases the rep-side transcript toward the names in play.
              prompt: `Sales call between a salesperson and ${persona.name} at ${persona.company}.`,
            },
            noise_reduction: { type: "near_field" },
            turn_detection: turnDetectionConfig(),
          },
          output: { voice },
        },
      },
    });
  } catch (err) {
    console.error("[voice] realtime client secret failed", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      {
        error: `Could not start the voice call (${message}). Check that the OpenAI project has Realtime access, or use the text role-play.`,
        code: "VOICE_CONNECT_FAILED",
      },
      { status: 502 },
    );
  }

  if (session.mode !== "VOICE") {
    await db.roleplaySession.update({ where: { id }, data: { mode: "VOICE" } });
  }

  return NextResponse.json({
    clientSecret: secret.value,
    expiresAt: secret.expires_at,
    model: REALTIME_MODEL,
    voice,
    personaName: persona.name,
    remainingSeconds: meter.remainingSeconds,
    limitSeconds: meter.limitSeconds,
    durationSec: meter.durationSec,
  });
}
