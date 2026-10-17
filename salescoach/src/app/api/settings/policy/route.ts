import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import type { IngestionPolicy } from "@/lib/types";

// POST /api/settings/policy — save the org's ingestion & sampling policy.

function intIn(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) return null;
  return v;
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!isManagerRole(user.role)) return NextResponse.json({ error: "Managers only." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const minDurationSec = intIn(body.minDurationSec, 0, 600);
  if (minDurationSec === null) {
    return NextResponse.json(
      { error: "Minimum duration must be a whole number between 0 and 600 seconds." },
      { status: 400 },
    );
  }
  const sampleThreshold = intIn(body.sampleThreshold, 1, 100);
  if (sampleThreshold === null) {
    return NextResponse.json(
      { error: "Sampling threshold must be a whole number between 1 and 100." },
      { status: 400 },
    );
  }
  const sampleSize = intIn(body.sampleSize, 1, 100);
  if (sampleSize === null) {
    return NextResponse.json(
      { error: "Sample size must be a whole number between 1 and 100." },
      { status: 400 },
    );
  }
  if (typeof body.gradeManualUploads !== "boolean") {
    return NextResponse.json({ error: "gradeManualUploads must be a boolean." }, { status: 400 });
  }

  const policy: IngestionPolicy = {
    minDurationSec,
    sampleThreshold,
    sampleSize,
    gradeManualUploads: body.gradeManualUploads,
  };
  await db.org.update({
    where: { id: user.orgId },
    data: { ingestionPolicyJson: JSON.stringify(policy) },
  });
  return NextResponse.json({ ok: true });
}
