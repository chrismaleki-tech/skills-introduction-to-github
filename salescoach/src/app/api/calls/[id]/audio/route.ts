import path from "path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { getObject } from "@/lib/storage";

// Streams stored call audio for the <audio> player on the review page.
// Same access rule as the page: reps only hear their own calls.

const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".webm": "audio/webm",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();

  const call = await db.call.findFirst({ where: { id, orgId: user.orgId } });
  if (!call || (!isManagerRole(user.role) && call.repId !== user.id)) {
    return NextResponse.json({ error: "Call not found." }, { status: 404 });
  }
  if (!call.audioPath) {
    return NextResponse.json({ error: "No audio stored for this call." }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await getObject(call.audioPath);
  } catch {
    return NextResponse.json({ error: "Audio file is missing from storage." }, { status: 404 });
  }

  const ext = call.audioPath.startsWith("s3://")
    ? path.extname(call.audioPath.split("/").pop() || "")
    : path.extname(call.audioPath);
  const contentType = CONTENT_TYPES[ext.toLowerCase()] ?? "application/octet-stream";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
