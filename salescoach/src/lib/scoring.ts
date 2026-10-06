import type { DimensionScore, ScoreBand } from "./types";

// The 100-point rollup. Dimensions are scored 1..5; a 1 maps to 0 points and a
// 5 maps to 100, weighted by dimension weight. Mechanical metrics are
// intentionally informational and never feed this number.
export function rollupScore(scores: Pick<DimensionScore, "score" | "weight">[]): number {
  const totalWeight = scores.reduce((s, d) => s + d.weight, 0);
  if (totalWeight <= 0) return 0;
  const weighted = scores.reduce((s, d) => s + ((clamp(d.score, 1, 5) - 1) / 4) * d.weight, 0);
  return Math.round((weighted / totalWeight) * 100);
}

export function bandFor(score: number): ScoreBand {
  if (score >= 90) return "exceptional";
  if (score >= 75) return "strong";
  if (score >= 60) return "developing";
  return "needs_coaching";
}

export const BAND_LABELS: Record<ScoreBand, string> = {
  exceptional: "Exceptional",
  strong: "Strong",
  developing: "Developing",
  needs_coaching: "Needs coaching",
};

export const BAND_COLORS: Record<ScoreBand, string> = {
  exceptional: "text-emerald-700 bg-emerald-50 border-emerald-200",
  strong: "text-brand bg-brand/10 border-brand/30",
  developing: "text-amber-700 bg-amber-50 border-amber-200",
  needs_coaching: "text-rose-700 bg-rose-50 border-rose-200",
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
