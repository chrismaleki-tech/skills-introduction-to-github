import type { Org, Prisma } from "@prisma/client";
import { db } from "./db";
import { billingAccess, billingError, complimentaryAccess } from "./billing";
import { PLANS, planForPriceId, TRIAL_ALLOWANCE, type PlanKey } from "./plans";
import type { TranscriptSegment } from "./types";

// Usage metering.
//
// Two allowance models share one ledger:
//   - Trial workspaces get one pool per feature (AI Role Play minutes, call
//     review minutes) shared by every member for the whole trial. The pool
//     never resets and inviting people does not enlarge it.
//   - Paid plans get per-seat, per-billing-month allowances.
//
// The ledger is the existing rows, not a parallel table:
//   - RoleplaySession.durationSec holds billed seconds. It grows only through
//     meterRoleplaySession(), which charges the real time elapsed since the
//     last liveness signal (capped), so connection setup, idle tabs and
//     abandoned sessions are not billed.
//   - Call.meteredSec / meterStatus hold one reservation per call. Processing
//     reserves before paid work starts, settles on success and releases on
//     failure; a retry of a settled or in-flight call reuses the row.
//
// All writes that can change the balance run under a per-org Postgres
// advisory lock so concurrent sessions, duplicate callbacks and retries are
// serialized and the cap cannot be overshot.

export type UsageKind = "roleplay" | "call_review";
export type AllowanceBasis = "trial" | "seat_month" | "unlimited";

type UsageOrg = Pick<
  Org,
  | "id"
  | "createdAt"
  | "planKey"
  | "planStatus"
  | "trialEndsAt"
  | "stripePriceId"
  | "subscriptionStartsAt"
  | "subscriptionEndsAt"
> &
  Partial<
    Pick<
      Org,
      | "bonusRoleplaySec"
      | "bonusCallReviewSec"
      | "compPlanKey"
      | "compExpiresAt"
      | "suspendedAt"
      | "suspendedReason"
    >
  >;

type DbClient = Prisma.TransactionClient | typeof db;

export type Allowance = {
  kind: UsageKind;
  basis: AllowanceBasis;
  /** Workspace pools (trial) or a single seat (paid). */
  scope: "workspace" | "seat";
  limitSeconds: number | null;
  usedSeconds: number;
  /** null when unlimited. */
  remainingSeconds: number | null;
  periodStart: Date;
  periodEnd: Date | null;
};

export type UsageSummary = {
  planKey: PlanKey;
  basis: AllowanceBasis;
  roleplay: Allowance;
  callReview: Allowance;
};

/** Liveness gap charged at most once per heartbeat, per session mode. */
export const ROLEPLAY_MAX_GAP_SECONDS = { VOICE: 45, TEXT: 120 } as const;

/**
 * Transcript-only call review has no recording to measure. The metered
 * length is the larger of the stated duration and the transcript's spoken
 * length at this conversational pace; it is flagged as an estimate.
 */
export const TRANSCRIPT_WORDS_PER_MINUTE = 150;

/** Remaining seconds at or below which the UI warns that a pool is nearly used up. */
export const LOW_ALLOWANCE_WARNING_SECONDS = 5 * 60;

export class UsageLimitError extends Error {
  readonly code: "ROLEPLAY_LIMIT_EXCEEDED" | "CALL_REVIEW_LIMIT_EXCEEDED";
  readonly kind: UsageKind;
  readonly basis: AllowanceBasis;
  readonly usedSeconds: number;
  readonly limitSeconds: number;
  readonly remainingSeconds: number;
  readonly requiredSeconds: number;
  readonly periodEnd: Date | null;

  constructor(opts: {
    kind: UsageKind;
    basis: AllowanceBasis;
    usedSeconds: number;
    limitSeconds: number;
    requiredSeconds: number;
    periodEnd: Date | null;
  }) {
    const remaining = Math.max(0, opts.limitSeconds - opts.usedSeconds);
    super(limitMessage({ ...opts, remainingSeconds: remaining }));
    this.name = "UsageLimitError";
    this.code = opts.kind === "roleplay" ? "ROLEPLAY_LIMIT_EXCEEDED" : "CALL_REVIEW_LIMIT_EXCEEDED";
    this.kind = opts.kind;
    this.basis = opts.basis;
    this.usedSeconds = opts.usedSeconds;
    this.limitSeconds = opts.limitSeconds;
    this.remainingSeconds = remaining;
    this.requiredSeconds = opts.requiredSeconds;
    this.periodEnd = opts.periodEnd;
  }
}

export function usageLimitPayload(error: UsageLimitError) {
  return {
    error: error.message,
    code: error.code,
    kind: error.kind,
    basis: error.basis,
    usedSeconds: error.usedSeconds,
    limitSeconds: error.limitSeconds,
    remainingSeconds: error.remainingSeconds,
    requiredSeconds: error.requiredSeconds,
    periodEnd: error.periodEnd ? error.periodEnd.toISOString() : null,
    billingUrl: "/billing",
  };
}

export function featureLabel(kind: UsageKind) {
  return kind === "roleplay" ? "AI Role Play" : "call review";
}

export function fmtMinutes(seconds: number) {
  const minutes = seconds / 60;
  if (minutes >= 10 || Number.isInteger(minutes)) return `${Math.round(minutes)} min`;
  return `${Math.round(minutes * 10) / 10} min`;
}

function limitMessage(opts: {
  kind: UsageKind;
  basis: AllowanceBasis;
  limitSeconds: number;
  remainingSeconds: number;
  requiredSeconds: number;
}) {
  const feature = featureLabel(opts.kind);
  const limit = fmtMinutes(opts.limitSeconds);
  if (opts.basis === "trial") {
    if (opts.remainingSeconds <= 0) {
      return `Your workspace has used all ${limit} of ${feature} included in the free trial. Upgrade to Pro or Max to keep going; everything you have saved stays available.`;
    }
    if (opts.kind === "call_review") {
      return `This recording is ${fmtMinutes(opts.requiredSeconds)}, but your workspace has ${fmtMinutes(opts.remainingSeconds)} of trial call review left. Upload a recording of ${fmtMinutes(opts.remainingSeconds)} or less, or upgrade for more.`;
    }
    return `Your workspace has ${fmtMinutes(opts.remainingSeconds)} of trial ${feature} left, which is not enough for this. Upgrade to Pro or Max for more.`;
  }
  if (opts.kind === "call_review" && opts.remainingSeconds > 0) {
    return `This recording is ${fmtMinutes(opts.requiredSeconds)}, but this seat has ${fmtMinutes(opts.remainingSeconds)} of ${feature} left this month (${limit} per seat). Upload a shorter recording, or add seats or upgrade from Billing.`;
  }
  return `This seat has reached its monthly ${feature} allowance of ${limit}. It resets at the next billing period; add seats or upgrade from Billing for more now.`;
}

// --- Plan resolution --------------------------------------------------------------

export function resolvedPlanKey(
  org: Pick<UsageOrg, "planKey" | "stripePriceId"> &
    Partial<Pick<Org, "compPlanKey" | "compExpiresAt" | "planStatus" | "subscriptionEndsAt">>,
  now = new Date(),
): PlanKey {
  const comp = complimentaryAccess(org, now);
  if (comp?.planKey === "pro" || comp?.planKey === "max") return comp.planKey;
  if (org.stripePriceId) return planForPriceId(org.stripePriceId);
  return org.planKey in PLANS ? (org.planKey as PlanKey) : "trial";
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

/** The window usage is counted over, and whether it is per workspace or per seat. */
export function allowanceWindow(org: UsageOrg, now = new Date()) {
  const planKey = resolvedPlanKey(org, now);
  if (planKey === "trial") {
    // One pool for the whole trial: every role-play and reviewed call the
    // workspace has ever recorded counts, whatever its timestamp.
    return {
      planKey,
      basis: "trial" as const,
      scope: "workspace" as const,
      // Unbounded lower bound so imported or backdated rows still count.
      // This is not a calendar date. Display it through describeAllowanceWindow.
      start: new Date(0),
      end: billingAccess(org).trialEndsAt,
    };
  }
  const period = billingPeriod(org, now);
  const plan = PLANS[planKey];
  const unlimited = plan.roleplayMinutesPerSeat === null && plan.callScoringMinutesPerSeat === null;
  return {
    planKey,
    basis: unlimited ? ("unlimited" as const) : ("seat_month" as const),
    scope: "seat" as const,
    start: period.start,
    end: period.end,
  };
}

/**
 * Words for the admin usage panel. Trial accounting keeps an epoch lower bound
 * so every recorded session counts; that sentinel is never shown as a date.
 */
export function describeAllowanceWindow(
  window: { basis: AllowanceBasis; start: Date; end: Date | null },
  formatDate: (value: Date) => string,
) {
  if (window.basis === "trial" || window.start.getTime() === 0) {
    const through = window.end ? ` It runs through ${formatDate(window.end)}.` : "";
    return `This pool counts all usage recorded for the workspace. It is not a calendar window and it does not reset.${through}`;
  }
  const started = `Window started ${formatDate(window.start)}`;
  return window.end ? `${started} and ends ${formatDate(window.end)}.` : `${started}.`;
}

/** Pure allowance arithmetic, shared by the server and the UI. */
export function allowanceFor(
  kind: UsageKind,
  limitSeconds: number | null,
  usedSeconds: number,
  window: { basis: AllowanceBasis; scope: "workspace" | "seat"; start: Date; end: Date | null },
): Allowance {
  return {
    kind,
    basis: limitSeconds === null ? "unlimited" : window.basis,
    scope: window.scope,
    limitSeconds,
    usedSeconds,
    remainingSeconds: limitSeconds === null ? null : Math.max(0, limitSeconds - usedSeconds),
    periodStart: window.start,
    periodEnd: window.end,
  };
}

export function limitSecondsFor(planKey: PlanKey, kind: UsageKind): number | null {
  const plan = PLANS[planKey];
  if (plan.trialAllowance) {
    return (kind === "roleplay" ? plan.trialAllowance.roleplayMinutes : plan.trialAllowance.callReviewMinutes) * 60;
  }
  const minutes = kind === "roleplay" ? plan.roleplayMinutesPerSeat : plan.callScoringMinutesPerSeat;
  return minutes === null ? null : minutes * 60;
}

/** Customer-facing explanation when a live role-play is stopped by the server. */
export function roleplayCutoffMessage(endedReason: "allowance_exhausted" | "trial_expired" | "workspace_suspended") {
  if (endedReason === "workspace_suspended") {
    return {
      code: "WORKSPACE_SUSPENDED" as const,
      error: "Erota has paused this workspace, so this call has ended. The transcript is saved. This is not a subscription cancellation.",
    };
  }
  if (endedReason === "trial_expired") {
    return {
      code: "TRIAL_EXPIRED" as const,
      error: "Your free trial ended during this call. The call has been saved; upgrade to Pro or Max to keep practicing.",
    };
  }
  return {
    code: "ROLEPLAY_LIMIT_EXCEEDED" as const,
    error: "Your workspace has used all of its trial AI Role Play minutes, so this call has ended. The transcript is saved; upgrade to Pro or Max for more.",
  };
}

export function limitSecondsForOrg(
  org: Partial<Pick<Org, "bonusRoleplaySec" | "bonusCallReviewSec">>,
  planKey: PlanKey,
  kind: UsageKind,
): number | null {
  const base = limitSecondsFor(planKey, kind);
  if (base === null) return null;
  const bonus = kind === "roleplay" ? (org.bonusRoleplaySec ?? 0) : (org.bonusCallReviewSec ?? 0);
  return base + Math.max(0, Math.round(bonus));
}

// --- Reading the ledger ------------------------------------------------------------

async function roleplaySecondsUsed(
  client: DbClient,
  orgId: string,
  repId: string | null,
  start: Date,
  end: Date | null,
) {
  const agg = await client.roleplaySession.aggregate({
    _sum: { durationSec: true },
    where: {
      orgId,
      ...(repId ? { repId } : {}),
      startedAt: { gte: start, ...(end ? { lt: end } : {}) },
    },
  });
  return agg._sum.durationSec ?? 0;
}

async function callReviewSecondsUsed(
  client: DbClient,
  orgId: string,
  repId: string | null,
  start: Date,
  end: Date | null,
) {
  const range = { gte: start, ...(end ? { lt: end } : {}) };
  const [metered, legacy] = await Promise.all([
    client.call.aggregate({
      _sum: { meteredSec: true },
      where: {
        orgId,
        ...(repId ? { repId } : {}),
        meterStatus: { in: ["RESERVED", "SETTLED"] },
        // A reservation has no settle time yet; count it from the call's own
        // date so an in-flight job is visible inside its window.
        OR: [{ meteredAt: range }, { meteredAt: null, createdAt: range }],
      },
    }),
    // Calls graded before metering existed (backfill not yet run): their
    // stated recording length counts, dated by the grade, exactly as before.
    client.call.aggregate({
      _sum: { durationSec: true },
      where: {
        orgId,
        ...(repId ? { repId } : {}),
        meterStatus: "NONE",
        grade: { is: { subjectType: "CALL", createdAt: range } },
      },
    }),
  ]);
  return (metered._sum.meteredSec ?? 0) + (legacy._sum.durationSec ?? 0);
}

/**
 * Current allowances for the org (trial: whole workspace) or for one seat
 * (paid plans). `repId` is ignored for trial workspaces on purpose.
 */
export async function usageSummary(
  org: UsageOrg,
  repId: string,
  client: DbClient = db,
  now = new Date(),
): Promise<UsageSummary> {
  const window = allowanceWindow(org, now);
  const scopedRep = window.scope === "workspace" ? null : repId;
  const [roleplayUsed, callReviewUsed] = await Promise.all([
    roleplaySecondsUsed(client, org.id, scopedRep, window.start, window.end),
    callReviewSecondsUsed(client, org.id, scopedRep, window.start, window.end),
  ]);
  return {
    planKey: window.planKey,
    basis: window.basis,
    roleplay: allowanceFor("roleplay", limitSecondsForOrg(org, window.planKey, "roleplay"), roleplayUsed, window),
    callReview: allowanceFor("call_review", limitSecondsForOrg(org, window.planKey, "call_review"), callReviewUsed, window),
  };
}

export async function allowance(
  org: UsageOrg,
  repId: string,
  kind: UsageKind,
  client: DbClient = db,
  now = new Date(),
): Promise<Allowance> {
  const window = allowanceWindow(org, now);
  const scopedRep = window.scope === "workspace" ? null : repId;
  const used =
    kind === "roleplay"
      ? await roleplaySecondsUsed(client, org.id, scopedRep, window.start, window.end)
      : await callReviewSecondsUsed(client, org.id, scopedRep, window.start, window.end);
  return allowanceFor(kind, limitSecondsForOrg(org, window.planKey, kind), used, window);
}

/**
 * Throw when `additionalSeconds` would overshoot the allowance. This is the
 * pre-check used by request handlers; the authoritative charge happens under
 * the org lock in meterRoleplaySession / reserveCallReview.
 */
export async function assertUsageAvailable(
  org: UsageOrg,
  repId: string,
  kind: UsageKind,
  additionalSeconds = 0,
  client: DbClient = db,
) {
  const current = await allowance(org, repId, kind, client);
  if (current.limitSeconds === null) return current;
  const required = Math.max(0, additionalSeconds);
  if (current.usedSeconds + required > current.limitSeconds || (required === 0 && current.remainingSeconds === 0)) {
    throw new UsageLimitError({
      kind,
      basis: current.basis,
      usedSeconds: current.usedSeconds,
      limitSeconds: current.limitSeconds,
      requiredSeconds: required,
      periodEnd: current.periodEnd,
    });
  }
  return current;
}

// --- Locking ----------------------------------------------------------------------------

/**
 * Run `fn` inside a transaction holding this org's usage lock. Every balance
 * change goes through here so concurrent requests see each other's charges.
 */
export async function withUsageLock<T>(orgId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`usage:${orgId}`}))::text AS acquired`;
      return fn(tx);
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

// --- Role-play metering ----------------------------------------------------------------

export type RoleplayMeterResult = {
  sessionId: string;
  status: string;
  durationSec: number;
  /** Seconds charged by this call. */
  chargedSec: number;
  remainingSeconds: number | null;
  limitSeconds: number | null;
  basis: AllowanceBasis;
  /** Set when this call had to end the session. */
  endedReason: "allowance_exhausted" | "trial_expired" | "workspace_suspended" | null;
};

/**
 * Charge the time elapsed since the session's last liveness signal and record
 * a new one. Call it when the voice token is minted, on every transcript
 * heartbeat, on every text turn, and when the session ends.
 *
 * - The first signal after a gap of more than the mode's max gap charges only
 *   the max gap, so a dropped connection or a closed tab costs at most one
 *   heartbeat interval.
 * - If the charge would exceed the remaining allowance, only the remainder is
 *   charged and the session is completed in the same transaction.
 * - If the trial has expired, the elapsed gap up to now is charged (capped)
 *   and the session is completed.
 * - `final` completes the session after charging regardless.
 * - `reportedSeconds` (provider end-of-call reports) charges up to that total
 *   instead of the liveness gap.
 *
 * Idempotent across duplicate callbacks and multiple tabs: time only passes
 * once, and every call runs under the org lock.
 */
export async function meterRoleplaySession(
  sessionId: string,
  opts: { now?: Date; final?: boolean; reportedSeconds?: number } = {},
): Promise<RoleplayMeterResult> {
  const now = opts.now ?? new Date();
  return withUsageLock(await orgIdForSession(sessionId), async (tx) => {
    const session = await tx.roleplaySession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { org: true },
    });
    const window = allowanceWindow(session.org, now);
    const limitSeconds = limitSecondsForOrg(session.org, window.planKey, "roleplay");
    const scopedRep = window.scope === "workspace" ? null : session.repId;

    const used = await roleplaySecondsUsed(tx, session.orgId, scopedRep, window.start, window.end);
    const remainingBefore = limitSeconds === null ? null : Math.max(0, limitSeconds - used);

    if (session.status !== "ACTIVE") {
      return {
        sessionId,
        status: session.status,
        durationSec: session.durationSec,
        chargedSec: 0,
        remainingSeconds: remainingBefore,
        limitSeconds,
        basis: window.basis,
        endedReason: null,
      };
    }

    const maxGap = session.mode === "VOICE" ? ROLEPLAY_MAX_GAP_SECONDS.VOICE : ROLEPLAY_MAX_GAP_SECONDS.TEXT;
    const elapsed = session.meteredAt ? Math.max(0, (now.getTime() - session.meteredAt.getTime()) / 1000) : 0;
    let charge = Math.min(elapsed, maxGap);
    if (opts.reportedSeconds !== undefined) {
      charge = Math.max(0, Math.round(opts.reportedSeconds) - session.durationSec);
    }

    let endedReason: RoleplayMeterResult["endedReason"] = null;
    const access = billingAccess(session.org);
    if (!access.entitled) endedReason = access.status === "suspended" ? "workspace_suspended" : "trial_expired";
    if (remainingBefore !== null && charge >= remainingBefore) {
      charge = remainingBefore;
      endedReason = endedReason ?? "allowance_exhausted";
    }
    const chargedSec = Math.round(charge);
    const ending = opts.final === true || endedReason !== null;

    const updated = await tx.roleplaySession.update({
      where: { id: sessionId },
      data: {
        durationSec: session.durationSec + chargedSec,
        meteredAt: ending ? null : now,
        ...(ending ? { status: "COMPLETED", endedAt: now } : {}),
      },
    });

    return {
      sessionId,
      status: updated.status,
      durationSec: updated.durationSec,
      chargedSec,
      remainingSeconds: remainingBefore === null ? null : Math.max(0, remainingBefore - chargedSec),
      limitSeconds,
      basis: window.basis,
      endedReason,
    };
  });
}

async function orgIdForSession(sessionId: string) {
  const row = await db.roleplaySession.findUniqueOrThrow({ where: { id: sessionId }, select: { orgId: true } });
  return row.orgId;
}

// --- Call review reservations --------------------------------------------------------

export type CallMeterInput = {
  source: string;
  durationSec: number;
  hasAudio: boolean;
  segments?: TranscriptSegment[] | null;
};

export function transcriptWordCount(segments: TranscriptSegment[]) {
  return segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);
}

/**
 * How many seconds a call charges against call review.
 * - Recordings (audio, or a provider webhook with a stated length): the
 *   recording duration. Processing time is irrelevant.
 * - Pasted transcripts without audio: the larger of the stated duration and
 *   the transcript's spoken length at TRANSCRIPT_WORDS_PER_MINUTE, flagged as
 *   an estimate.
 */
export function meterSecondsForCall(input: CallMeterInput): { seconds: number; estimated: boolean } {
  const stated = Math.max(0, Math.round(input.durationSec));
  if (input.hasAudio || input.source !== "UPLOAD" || !input.segments || input.segments.length === 0) {
    return { seconds: stated, estimated: false };
  }
  const spoken = Math.round((transcriptWordCount(input.segments) / TRANSCRIPT_WORDS_PER_MINUTE) * 60);
  return { seconds: Math.max(stated, spoken), estimated: true };
}

export type ReserveResult =
  | { reserved: true; meteredSec: number; estimated: boolean; alreadyHeld: boolean }
  | { reserved: false; error: UsageLimitError };

/**
 * Reserve call-review allowance for a call before paid processing starts.
 * One reservation per call: a SETTLED or RESERVED call is returned as already
 * held (retries and duplicate jobs do not charge again); NONE or RELEASED
 * calls are charged if the allowance covers them.
 */
export async function reserveCallReview(callId: string, meter: { seconds: number; estimated: boolean }): Promise<ReserveResult> {
  const head = await db.call.findUniqueOrThrow({ where: { id: callId }, select: { orgId: true } });
  return withUsageLock(head.orgId, async (tx) => {
    const call = await tx.call.findUniqueOrThrow({ where: { id: callId }, include: { org: true } });
    if (call.meterStatus === "SETTLED" || call.meterStatus === "RESERVED") {
      return { reserved: true, meteredSec: call.meteredSec, estimated: call.meterEstimated, alreadyHeld: true };
    }
    const window = allowanceWindow(call.org);
    const limitSeconds = limitSecondsForOrg(call.org, window.planKey, "call_review");
    const scopedRep = window.scope === "workspace" ? null : call.repId;
    const used = await callReviewSecondsUsed(tx, call.orgId, scopedRep, window.start, window.end);
    if (limitSeconds !== null && used + meter.seconds > limitSeconds) {
      return {
        reserved: false,
        error: new UsageLimitError({
          kind: "call_review",
          basis: window.basis,
          usedSeconds: used,
          limitSeconds,
          requiredSeconds: meter.seconds,
          periodEnd: window.end,
        }),
      };
    }
    await tx.call.update({
      where: { id: callId },
      data: { meterStatus: "RESERVED", meteredSec: meter.seconds, meterEstimated: meter.estimated, meteredAt: null },
    });
    return { reserved: true, meteredSec: meter.seconds, estimated: meter.estimated, alreadyHeld: false };
  });
}

/** Processing succeeded: the reservation becomes a settled charge. */
export async function settleCallReview(callId: string, now = new Date()) {
  await db.call.updateMany({
    where: { id: callId, meterStatus: "RESERVED" },
    data: { meterStatus: "SETTLED", meteredAt: now },
  });
}

/** Processing failed: give the reserved seconds back. Settled charges are kept. */
export async function releaseCallReview(callId: string) {
  await db.call.updateMany({
    where: { id: callId, meterStatus: "RESERVED" },
    data: { meterStatus: "RELEASED", meteredAt: null },
  });
}

// --- Trial status for the UI ---------------------------------------------------------

export type TrialStatus = {
  active: boolean;
  expired: boolean;
  daysLeft: number;
  trialEndsAt: Date | null;
  totalDays: number;
  roleplay: Allowance;
  callReview: Allowance;
  seats: { used: number; members: number; pendingInvites: number; limit: number };
};

/** Everything the dashboard needs to show a trialing workspace its position. */
export async function trialStatus(org: UsageOrg, client: DbClient = db): Promise<TrialStatus | null> {
  if (resolvedPlanKey(org) !== "trial") return null;
  const access = billingAccess(org);
  const [summary, members, pendingInvites] = await Promise.all([
    usageSummary(org, "", client),
    client.user.count({ where: { orgId: org.id, removedAt: null } }),
    client.invite.count({ where: { orgId: org.id, status: "pending", expiresAt: { gt: new Date() } } }),
  ]);
  return {
    active: access.entitled && access.status === "trialing",
    expired: !access.entitled,
    daysLeft: access.daysLeft,
    trialEndsAt: access.trialEndsAt,
    totalDays: TRIAL_ALLOWANCE.days,
    roleplay: summary.roleplay,
    callReview: summary.callReview,
    seats: { used: members + pendingInvites, members, pendingInvites, limit: TRIAL_ALLOWANCE.seats },
  };
}

// --- Convenience for pages ---------------------------------------------------------------

/**
 * Why a new metered activity cannot start right now, or null when it can.
 * Combines billing status (trial ended / subscription lapsed) with the
 * feature's allowance.
 */
export async function startBlockReason(
  org: UsageOrg,
  repId: string,
  kind: UsageKind,
  client: DbClient = db,
): Promise<{ reason: string; code: string; allowance: Allowance | null } | null> {
  const access = billingAccess(org);
  if (!access.entitled) {
    if (access.status === "suspended") {
      return { code: "WORKSPACE_SUSPENDED", reason: billingError(org)!.error, allowance: null };
    }
    const trial = org.planStatus === "trialing";
    return {
      code: trial ? "TRIAL_EXPIRED" : "SUBSCRIPTION_REQUIRED",
      reason: trial
        ? `Your ${TRIAL_ALLOWANCE.days}-day free trial has ended. Upgrade to Pro or Max to keep using ${featureLabel(kind)}; your saved results are still here.`
        : `A paid subscription is required to use ${featureLabel(kind)}.`,
      allowance: null,
    };
  }
  const current = await allowance(org, repId, kind, client);
  if (current.remainingSeconds === 0) {
    const limit = fmtMinutes(current.limitSeconds ?? 0);
    return {
      code: kind === "roleplay" ? "ROLEPLAY_LIMIT_EXCEEDED" : "CALL_REVIEW_LIMIT_EXCEEDED",
      reason:
        current.basis === "trial"
          ? `Your workspace has used all ${limit} of ${featureLabel(kind)} included in the free trial. Upgrade to Pro or Max for more.`
          : `This seat has used its monthly ${featureLabel(kind)} allowance of ${limit}.`,
      allowance: current,
    };
  }
  return null;
}
