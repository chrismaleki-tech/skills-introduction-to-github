import { parseDimensionScores } from "@/lib/types";

// Pure aggregation helpers shared by the dashboard, team drill-down, and /me
// pages. Everything here operates on already-fetched rows — no db access.

export interface ScoredGrade {
  overallScore: number;
  managerOverrideScore: number | null;
}

// The one true score used for every aggregation: manager calibration wins.
export function effectiveScore(g: ScoredGrade): number {
  return g.managerOverrideScore ?? g.overallScore;
}

// When the graded activity actually happened. Grade.createdAt is when the
// grading pipeline ran (e.g. at bulk ingestion time), so time-bucketed views
// use the call date / role-play start instead, falling back to createdAt.
export function activityDate(g: {
  createdAt: Date;
  call?: { callDate: Date } | null;
  roleplay?: { startedAt: Date } | null;
}): Date {
  return g.call?.callDate ?? g.roleplay?.startedAt ?? g.createdAt;
}

export function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function roundOrNull(n: number | null): number | null {
  return n == null ? null : Math.round(n);
}

// Month boundaries. `prevMonthStart` relies on Date normalizing month -1 at
// the January/December boundary.
export function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function prevMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

// Monday 00:00 local time of the week containing `d` (ISO-ish weeks).
export function weekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x;
}

export function daysAgo(from: Date, n: number): Date {
  return new Date(from.getTime() - n * 86400000);
}

// Average 1-5 score per rubric dimension key across a set of grades'
// dimensionScoresJson payloads.
export function dimensionAverages(dimensionScoreJsons: string[]): Map<string, number> {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const json of dimensionScoreJsons) {
    for (const ds of parseDimensionScores(json)) {
      const cur = acc.get(ds.key) ?? { sum: 0, n: 0 };
      cur.sum += ds.score;
      cur.n += 1;
      acc.set(ds.key, cur);
    }
  }
  const out = new Map<string, number>();
  for (const [key, { sum, n }] of acc) out.set(key, sum / n);
  return out;
}

// Lowest-scoring dimension of a single grade — the "work on this" pointer.
export function weakestDimension(dimensionScoresJson: string): { name: string; score: number } | null {
  const scores = parseDimensionScores(dimensionScoresJson);
  if (scores.length === 0) return null;
  const weakest = scores.reduce((min, ds) => (ds.score < min.score ? ds : min));
  return { name: weakest.name, score: weakest.score };
}
