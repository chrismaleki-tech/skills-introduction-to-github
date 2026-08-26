import { db } from "./db";

/**
 * Lightweight usage metering for pre-production billing readiness.
 * Records billable events; a Stripe/metering provider can consume these later.
 */

export type UsageEventType =
  | "CALL_GRADED"
  | "ROLEPLAY_GRADED"
  | "VOICE_SESSION"
  | "TRANSCRIPTION_MINUTES"
  | "USER_SEAT";

export async function recordUsage(input: {
  orgId: string;
  type: UsageEventType;
  quantity?: number;
  userId?: string | null;
  subjectType?: string;
  subjectId?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    await db.usageEvent.create({
      data: {
        orgId: input.orgId,
        type: input.type,
        quantity: input.quantity ?? 1,
        userId: input.userId ?? null,
        subjectType: input.subjectType ?? "",
        subjectId: input.subjectId ?? null,
        metaJson: JSON.stringify(input.meta ?? {}),
      },
    });
  } catch {
    // Metering must never break the primary product path.
  }
}

export async function usageSummary(orgId: string, since: Date) {
  const events = await db.usageEvent.groupBy({
    by: ["type"],
    where: { orgId, createdAt: { gte: since } },
    _sum: { quantity: true },
    _count: true,
  });
  return events.map((e) => ({
    type: e.type,
    count: e._count,
    quantity: e._sum.quantity ?? 0,
  }));
}
