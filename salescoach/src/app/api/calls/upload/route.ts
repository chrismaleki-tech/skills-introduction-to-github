import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestCall } from "@/lib/pipeline";
import { currentUser, isManagerRole } from "@/lib/session";
import { deleteAudio, readAudio, storeAudio } from "@/lib/storage";
import { billingError } from "@/lib/billing";
import {
  assertUsageAvailable,
  UsageLimitError,
  usageLimitPayload,
} from "@/lib/usage";
import {
  AUDIO_TYPES,
  audioExtension,
  audioLimitLabel,
  MAX_AUDIO_BYTES,
  MAX_CALL_DURATION_SECONDS,
  MAX_TRANSCRIPT_CHARS,
  validAudioSignature,
  validAudioType,
} from "@/lib/upload-limits";

// Manual call upload: multipart form with either an audio file or a pasted
// transcript. Uploads bypass sampling per policy (gradeManualUploads), so the
// pipeline usually grades inline before this responds.

const CALL_TYPES = new Set(["cold_call", "discovery", "demo", "negotiation", "renewal", "unknown"]);

export const maxDuration = 300;

export async function POST(req: Request) {
  const user = await currentUser();
  const paymentError = billingError(user.org);
  if (paymentError) return NextResponse.json(paymentError, { status: 402 });
  const form = await req.formData();

  // Managers may upload on behalf of a rep in their org.
  let repId = user.id;
  const requestedRepId = str(form.get("repId"));
  if (requestedRepId && requestedRepId !== user.id) {
    if (!isManagerRole(user.role)) {
      return NextResponse.json({ error: "Only managers can upload on behalf of a rep." }, { status: 403 });
    }
    const rep = await db.user.findFirst({ where: { id: requestedRepId, orgId: user.orgId } });
    if (!rep) {
      return NextResponse.json({ error: "Unknown rep for this organization." }, { status: 400 });
    }
    repId = rep.id;
  }

  const durationSec = Math.round(Number(str(form.get("durationSec"))));
  if (
    !Number.isFinite(durationSec) ||
    durationSec <= 0 ||
    durationSec > MAX_CALL_DURATION_SECONDS
  ) {
    return NextResponse.json(
      { error: "durationSec must be between 1 second and 4 hours." },
      { status: 400 },
    );
  }
  try {
    await assertUsageAvailable(user.org, repId, "call_scoring", durationSec);
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return NextResponse.json(usageLimitPayload(error), { status: 402 });
    }
    throw error;
  }

  const callType = str(form.get("callType")) || "unknown";
  if (!CALL_TYPES.has(callType)) {
    return NextResponse.json({ error: `Unknown callType "${callType}".` }, { status: 400 });
  }
  const direction = str(form.get("direction")) === "inbound" ? "inbound" : "outbound";
  const prospectName = str(form.get("prospectName")).trim();

  const audioFile = form.get("audio");
  const audioRef = str(form.get("audioRef"));
  const audioMimeType = str(form.get("audioMimeType")).toLowerCase();
  const transcriptText = str(form.get("transcript")).trim();
  if (transcriptText.length > MAX_TRANSCRIPT_CHARS) {
    return NextResponse.json(
      { error: `Transcript is too long (maximum ${MAX_TRANSCRIPT_CHARS.toLocaleString()} characters).` },
      { status: 400 },
    );
  }

  let audio: { buffer: Buffer; mimeType: string; path: string } | undefined;
  if (audioFile instanceof File && audioFile.size > 0) {
    const ext = audioExtension(audioFile.name);
    const mimeType = audioFile.type.toLowerCase();
    if (!ext || !validAudioType(ext, mimeType)) {
      return NextResponse.json(
        { error: "Use an mp3, wav, m4a, or webm file with a matching content type." },
        { status: 400 },
      );
    }
    if (audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: `Audio files must be no larger than ${audioLimitLabel()}.` },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    if (!validAudioSignature(buffer, ext)) {
      return NextResponse.json(
        { error: "The file contents do not match the selected audio format." },
        { status: 400 },
      );
    }
    const storedPath = await storeAudio({
      orgId: user.orgId,
      ext,
      buffer,
      contentType: mimeType,
    });
    audio = { buffer, mimeType, path: storedPath };
  } else if (audioRef) {
    const expectedPrefix = `s3:orgs/${user.orgId}/calls/`;
    const ext = audioExtension(audioRef);
    if (
      !audioRef.startsWith(expectedPrefix) ||
      !ext ||
      !validAudioType(ext, audioMimeType)
    ) {
      return NextResponse.json({ error: "Invalid direct-upload audio reference." }, { status: 400 });
    }
    const stored = await readAudio(audioRef);
    if (stored.buffer.length > MAX_AUDIO_BYTES) {
      await deleteAudio(audioRef);
      return NextResponse.json(
        { error: `Audio files must be no larger than ${audioLimitLabel()}.` },
        { status: 400 },
      );
    }
    if (!validAudioSignature(stored.buffer, ext)) {
      await deleteAudio(audioRef);
      return NextResponse.json(
        { error: "The uploaded object does not contain a valid audio file." },
        { status: 400 },
      );
    }
    audio = {
      buffer: stored.buffer,
      mimeType: audioMimeType || AUDIO_TYPES[ext][0],
      path: audioRef,
    };
  }

  if (!audio && !transcriptText) {
    return NextResponse.json(
      { error: "Provide either an audio file or a pasted transcript." },
      { status: 400 },
    );
  }

  const startedAt = new Date(Date.now() - 1000);
  try {
    const { call } = await ingestCall({
      orgId: user.orgId,
      repId,
      source: "UPLOAD",
      direction,
      callType,
      durationSec,
      prospectName,
      audio,
      providedTranscript: audio ? undefined : transcriptText,
    });
    return NextResponse.json({ callId: call.id });
  } catch (err) {
    if (err instanceof UsageLimitError) {
      return NextResponse.json(usageLimitPayload(err), { status: 402 });
    }
    // The pipeline marks the Call FAILED before rethrowing, so if the row was
    // created we can still hand the caller its id for the review page.
    const failed = await db.call.findFirst({
      where: {
        orgId: user.orgId,
        repId,
        source: "UPLOAD",
        status: "FAILED",
        createdAt: { gte: startedAt },
        ...(audio ? { audioPath: audio.path } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    if (failed) return NextResponse.json({ callId: failed.id });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 400 },
    );
  }
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}
