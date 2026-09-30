import type { IngestionPolicy } from "./types";

// Per-rep sampling policy (locked decision):
//   - A rep with <= sampleThreshold eligible calls in the month gets everything graded.
//   - Beyond that, a random sample of ~sampleSize calls per month is graded,
//     drawn continuously through the month (pace-projected streaming sampling,
//     since grading happens at ingestion time and cannot be revoked).
//   - Rep-flagged, manager-requested, and manual uploads always grade and do
//     not consume the sampling budget.
// Stratification: calls from a duration band with no sampled calls yet this
// month get a boosted probability, so the sample is not all short cold calls.

export interface RepMonthStats {
  eligibleCallsThisMonth: number; // auto-ingested eligible calls, including the current one
  autoGradedThisMonth: number; // graded via threshold/sampling (not flagged/manual)
  sampledInSameDurationBand: number; // sampled calls this month in the current call's band
  dayOfMonth: number; // 1..31
  daysInMonth: number;
}

export interface SamplingDecision {
  grade: boolean;
  samplingStatus:
    | "WITHIN_THRESHOLD"
    | "SAMPLED"
    | "NOT_SAMPLED"
    | "BELOW_MIN_DURATION"
    | "MANUAL_UPLOAD"
    | "REP_FLAGGED";
}

export function decideSampling(
  policy: IngestionPolicy,
  call: { durationSec: number; source: string; repFlagged?: boolean },
  stats: RepMonthStats,
  rand: () => number = Math.random,
): SamplingDecision {
  if (call.durationSec < policy.minDurationSec) {
    return { grade: false, samplingStatus: "BELOW_MIN_DURATION" };
  }
  if (call.repFlagged) {
    return { grade: true, samplingStatus: "REP_FLAGGED" };
  }
  if (call.source === "UPLOAD") {
    return policy.gradeManualUploads
      ? { grade: true, samplingStatus: "MANUAL_UPLOAD" }
      : { grade: false, samplingStatus: "NOT_SAMPLED" };
  }

  const n = stats.eligibleCallsThisMonth;
  const projected = Math.max(
    n,
    Math.round((n * stats.daysInMonth) / Math.max(1, stats.dayOfMonth)),
  );

  // While the rep's projected monthly volume stays at or under the threshold,
  // grade everything — this is the "10 or fewer calls: grade all" guarantee.
  if (projected <= policy.sampleThreshold) {
    return { grade: true, samplingStatus: "WITHIN_THRESHOLD" };
  }

  // High-volume rep: spend the remaining sample budget randomly across the
  // projected remaining calls this month.
  const remainingBudget = policy.sampleSize - stats.autoGradedThisMonth;
  if (remainingBudget <= 0) {
    return { grade: false, samplingStatus: "NOT_SAMPLED" };
  }
  const projectedRemaining = Math.max(1, projected - n + 1);
  let p = remainingBudget / projectedRemaining;
  if (stats.sampledInSameDurationBand === 0) p *= 1.5; // stratification boost
  p = Math.min(1, p);

  return rand() < p
    ? { grade: true, samplingStatus: "SAMPLED" }
    : { grade: false, samplingStatus: "NOT_SAMPLED" };
}

// Duration bands used for stratification and coverage reporting.
export function durationBand(durationSec: number): "short" | "medium" | "long" {
  if (durationSec < 300) return "short"; // < 5 min
  if (durationSec < 1200) return "medium"; // 5-20 min
  return "long";
}
