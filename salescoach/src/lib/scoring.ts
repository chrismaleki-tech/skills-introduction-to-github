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
  exceptional: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  strong: "text-accent-hover bg-accent/10 border-accent/30",
  developing: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  needs_coaching: "text-rose-400 bg-rose-400/10 border-rose-400/30",
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
