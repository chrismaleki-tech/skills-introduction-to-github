// Small presentational pill for scenario difficulty (easy / medium / hard).
export function DifficultyPill({ difficulty }: { difficulty: string }) {
  const styles: Record<string, string> = {
    easy: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    medium: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    hard: "text-rose-400 bg-rose-400/10 border-rose-400/30",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
        styles[difficulty] ?? "text-slate-400 bg-slate-400/10 border-slate-400/30"
      }`}
    >
      {difficulty}
    </span>
  );
}

export function fmtCallType(callType: string): string {
  return callType.replaceAll("_", " ");
}
