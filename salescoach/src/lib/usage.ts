import type { Org } from "@prisma/client";
import { db } from "./db";
import { PLANS, planForPriceId, type PlanKey } from "./plans";

type UsageOrg = Pick<
  Org,
  | "id"
  | "createdAt"
  | "planKey"
  | "stripePriceId"
  | "subscriptionStartsAt"
  | "subscriptionEndsAt"
>;

export type UsageKind = "roleplay" | "call_scoring";

export type RepUsage = {
  periodStart: Date;
  periodEnd: Date;
  roleplaySeconds: number;
  callScoringSeconds: number;
};

export class UsageLimitError extends Error {
  readonly code: "ROLEPLAY_LIMIT_EXCEEDED" | "CALL_SCORING_LIMIT_EXCEEDED";
  readonly kind: UsageKind;
  readonly usedSeconds: number;
  readonly limitSeconds: number;
  readonly periodEnd: Date;

  constructor(opts: {
    kind: UsageKind;
    usedSeconds: number;
    limitSeconds: number;
    periodEnd: Date;
  }) {
    const label = opts.kind === "roleplay" ? "AI role-play" : "call scoring";
    super(`This seat has reached its monthly ${label} allowance.`);
    this.name = "UsageLimitError";
    this.code =
      opts.kind === "roleplay"
        ? "ROLEPLAY_LIMIT_EXCEEDED"
        : "CALL_SCORING_LIMIT_EXCEEDED";
    this.kind = opts.kind;
    this.usedSeconds = opts.usedSeconds;
    this.limitSeconds = opts.limitSeconds;
    this.periodEnd = opts.periodEnd;
  }
}

export function usageLimitPayload(error: UsageLimitError) {
  return {
    error: error.message,
    code: error.code,
    usedSeconds: error.usedSeconds,
    limitSeconds: error.limitSeconds,
    periodEnd: error.periodEnd.toISOString(),
    billingUrl: "/billing",
  };
}

export function billingPeriod(org: UsageOrg, now = new Date()) {
  if (org.subscriptionStartsAt && org.subscriptionEndsAt) {
    return { start: org.subscriptionStartsAt, end: org.subscriptionEndsAt };
  }

  if (org.subscriptionEndsAt) {
    const start = new Date(org.subscriptionEndsAt);
    start.setUTCMonth(start.getUTCMonth() - 1);
    return { start, end: org.subscriptionEndsAt };
  }

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

export function resolvedPlanKey(org: Pick<UsageOrg, "planKey" | "stripePriceId">): PlanKey {
  if (org.stripePriceId) return planForPriceId(org.stripePriceId);
  return org.planKey in PLANS ? (org.planKey as PlanKey) : "trial";
}

export async function usageForRep(org: UsageOrg, repId: string): Promise<RepUsage> {
  const period = billingPeriod(org);
  const [roleplay, calls] = await Promise.all([
    db.roleplaySession.aggregate({
      _sum: { durationSec: true },
      where: {
        orgId: org.id,
        repId,
        startedAt: { gte: period.start, lt: period.end },
        status: { in: ["ACTIVE", "COMPLETED", "GRADED"] },
      },
    }),
    db.call.aggregate({
      _sum: { durationSec: true },
      where: {
        orgId: org.id,
        repId,
        grade: {
          is: {
            subjectType: "CALL",
            createdAt: { gte: period.start, lt: period.end },
          },
        },
      },
    }),
  ]);

  return {
    periodStart: period.start,
    periodEnd: period.end,
    roleplaySeconds: roleplay._sum.durationSec ?? 0,
    callScoringSeconds: calls._sum.durationSec ?? 0,
  };
}

export async function assertUsageAvailable(
  org: UsageOrg,
  repId: string,
  kind: UsageKind,
  additionalSeconds = 0,
) {
  const plan = PLANS[resolvedPlanKey(org)];
  const limitMinutes =
    kind === "roleplay"
      ? plan.roleplayMinutesPerSeat
      : plan.callScoringMinutesPerSeat;
  if (limitMinutes === null) return;

  const usage = await usageForRep(org, repId);
  const usedSeconds =
    kind === "roleplay" ? usage.roleplaySeconds : usage.callScoringSeconds;
  const limitSeconds = limitMinutes * 60;
  if (usedSeconds + Math.max(0, additionalSeconds) > limitSeconds) {
    throw new UsageLimitError({
      kind,
      usedSeconds,
      limitSeconds,
      periodEnd: usage.periodEnd,
    });
  }
}
