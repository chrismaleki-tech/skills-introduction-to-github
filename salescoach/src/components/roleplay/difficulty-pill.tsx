import { callTypeLabel, difficultyLabel } from "@/lib/scenario-options";

// Small presentational pill for scenario difficulty (easy / medium / hard,
// shown to users as Beginner / Intermediate / Advanced).
export function DifficultyPill({ difficulty }: { difficulty: string }) {
  const styles: Record<string, string> = {
    easy: "text-emerald-700 bg-emerald-50 border-emerald-200",
    medium: "text-amber-700 bg-amber-50 border-amber-200",
    hard: "text-rose-700 bg-rose-50 border-rose-200",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        styles[difficulty] ?? "text-slate-600 bg-slate-100 border-slate-200"
      }`}
    >
      {difficultyLabel(difficulty)}
    </span>
  );
}

// Human label for a call type, e.g. "cold_call" → "Cold call".
export function fmtCallType(callType: string): string {
  return callTypeLabel(callType);
}
