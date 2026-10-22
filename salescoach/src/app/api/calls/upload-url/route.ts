import { NextResponse } from "next/server";
import { billingError } from "@/lib/billing";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { createAudioUpload, storageBackend } from "@/lib/storage";
import {
  audioExtension,
  audioLimitLabel,
  MAX_AUDIO_BYTES,
  MAX_CALL_DURATION_SECONDS,
  validAudioType,
} from "@/lib/upload-limits";
import {
  assertUsageAvailable,
  UsageLimitError,
  usageLimitPayload,
} from "@/lib/usage";

export async function POST(req: Request) {
  const user = await currentUser();
  const paymentError = billingError(user.org);
  if (paymentError) return NextResponse.json(paymentError, { status: 402 });
  if (storageBackend() !== "s3") {
    return NextResponse.json(
      { error: "Direct audio upload requires S3 or R2 storage." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    fileName?: string;
    contentType?: string;
    size?: number;
    repId?: string;
    durationSec?: number;
  };
  const extension = audioExtension(body.fileName ?? "");
  const size = Number(body.size);
  const contentType = body.contentType?.toLowerCase() ?? "";

  if (!extension || !validAudioType(extension, contentType)) {
    return NextResponse.json(
      { error: "Use an mp3, wav, m4a, or webm audio file with a matching content type." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: `Audio files must be no larger than ${audioLimitLabel()}.` },
      { status: 400 },
    );
  }
  const durationSec = Math.round(Number(body.durationSec));
  if (
    !Number.isFinite(durationSec) ||
    durationSec <= 0 ||
    durationSec > MAX_CALL_DURATION_SECONDS
  ) {
    return NextResponse.json({ error: "Enter a valid call duration." }, { status: 400 });
  }

  let repId = user.id;
  if (body.repId && body.repId !== user.id) {
    if (!isManagerRole(user.role)) {
      return NextResponse.json({ error: "Only managers can upload for another rep." }, { status: 403 });
    }
    const rep = await db.user.findFirst({
      where: { id: body.repId, orgId: user.orgId, removedAt: null },
      select: { id: true },
    });
    if (!rep) return NextResponse.json({ error: "Unknown rep." }, { status: 400 });
    repId = rep.id;
  }
  try {
    await assertUsageAvailable(user.org, repId, "call_scoring", durationSec);
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return NextResponse.json(usageLimitPayload(error), { status: 402 });
    }
    throw error;
  }

  const upload = await createAudioUpload({
    orgId: user.orgId,
    ext: extension,
    contentType,
  });
  return NextResponse.json(upload);
}
