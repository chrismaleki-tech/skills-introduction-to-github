import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { billingError } from "@/lib/billing";
import { voiceAvailable } from "@/lib/roleplay";
import {
  assertUsageAvailable,
  UsageLimitError,
  usageLimitPayload,
} from "@/lib/usage";

// Start a role-play session against a scenario. Voice (live spoken call with
// the AI prospect) is the default whenever the server can mint Realtime
// sessions; text is the explicit fallback, and the only option without a key.
//
// Starting is refused when the trial has ended or the workspace's AI Role Play
// allowance is used up. Minutes are charged while the session runs (see
// meterRoleplaySession), not here.
export async function POST(req: Request) {
  const user = await currentUser();
  const paymentError = billingError(user.org);
  if (paymentError) return NextResponse.json(paymentError, { status: 402 });
  let remainingSeconds: number | null;
  try {
    remainingSeconds = (await assertUsageAvailable(user.org, user.id, "roleplay", 0)).remainingSeconds;
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return NextResponse.json(usageLimitPayload(error), { status: 402 });
    }
    throw error;
  }
  const body = (await req.json().catch(() => ({}))) as { scenarioId?: string; mode?: string };
  if (!body.scenarioId) {
    return NextResponse.json({ error: "scenarioId required" }, { status: 400 });
  }
  if (body.mode !== undefined && body.mode !== "VOICE" && body.mode !== "TEXT") {
    return NextResponse.json({ error: "mode must be VOICE or TEXT" }, { status: 400 });
  }
  const requested = body.mode ?? (voiceAvailable() ? "VOICE" : "TEXT");
  if (requested === "VOICE" && !voiceAvailable()) {
    return NextResponse.json(
      {
        error: "Voice role-play is not configured on this server. Start a text role-play instead.",
        code: "VOICE_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  const scenario = await db.scenario.findUnique({ where: { id: body.scenarioId } });
  if (!scenario || scenario.orgId !== user.orgId) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }

  const session = await db.roleplaySession.create({
    data: {
      orgId: user.orgId,
      repId: user.id,
      scenarioId: scenario.id,
      mode: requested,
      status: "ACTIVE",
      messagesJson: "[]",
      // A text chat is live as soon as it opens; a voice call starts metering
      // when the Realtime token is minted, after the microphone prompt.
      meteredAt: requested === "TEXT" ? new Date() : null,
    },
  });

  return NextResponse.json({ id: session.id, mode: session.mode, remainingSeconds });
}
