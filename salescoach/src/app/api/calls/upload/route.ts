import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestCall } from "@/lib/pipeline";
import { currentUser, isManagerRole } from "@/lib/session";
import { putObject } from "@/lib/storage";

// Manual call upload: multipart form with either an audio file or a pasted
// transcript. Uploads bypass sampling per policy (gradeManualUploads), so the
// pipeline usually grades inline before this responds.

const AUDIO_EXTENSIONS: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  webm: "audio/webm",
};

const CALL_TYPES = new Set(["cold_call", "discovery", "demo", "negotiation", "renewal", "unknown"]);

export async function POST(req: Request) {
  const user = await currentUser();
  const form = await req.formData();

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
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return NextResponse.json({ error: "durationSec must be a positive number of seconds." }, { status: 400 });
  }

  const callType = str(form.get("callType")) || "unknown";
  if (!CALL_TYPES.has(callType)) {
    return NextResponse.json({ error: `Unknown callType "${callType}".` }, { status: 400 });
  }
  const direction = str(form.get("direction")) === "inbound" ? "inbound" : "outbound";
  const prospectName = str(form.get("prospectName")).trim();

  const audioFile = form.get("audio");
  const transcriptText = str(form.get("transcript")).trim();

  let audio: { buffer: Buffer; mimeType: string; path: string } | undefined;
  if (audioFile instanceof File && audioFile.size > 0) {
    const ext = (audioFile.name.split(".").pop() ?? "").toLowerCase();
    if (!AUDIO_EXTENSIONS[ext]) {
      return NextResponse.json(
        { error: `Unsupported audio format ".${ext}". Use mp3, wav, m4a or webm.` },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const stored = await putObject(buffer, {
      ext,
      contentType: audioFile.type || AUDIO_EXTENSIONS[ext],
      keyPrefix: `org/${user.orgId}/calls`,
    });
    audio = { buffer, mimeType: stored.contentType, path: stored.path };
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
