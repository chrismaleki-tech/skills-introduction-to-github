import Link from "next/link";

// Skill heatmap: reps × rubric dimensions, average 1-5 dimension score over
// the lookback window. Answers "where is my team weak" at a glance.

export interface HeatmapRow {
  name: string;
  href?: string;
  sub?: string;
  cells: (number | null)[];
  isAverage?: boolean;
}

function cellTint(v: number | null): string {
  if (v == null) return "text-muted";
  if (v >= 4) return "bg-emerald-400/15 text-emerald-300";
  if (v >= 3) return "bg-sky-400/15 text-sky-300";
  if (v >= 2.5) return "bg-amber-400/15 text-amber-300";
  return "bg-rose-400/15 text-rose-300";
}

export function SkillHeatmap({ dimensions, rows }: { dimensions: { key: string; name: string }[]; rows: HeatmapRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="text-left text-xs text-muted font-medium uppercase tracking-wider pb-2 pr-3">Rep</th>
            {dimensions.map((d) => (
              <th key={d.key} className="text-center text-xs text-muted font-medium pb-2 px-1 max-w-24 align-bottom" title={d.name}>
                <span className="line-clamp-2">{d.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className={row.isAverage ? "border-t border-line" : ""}>
              <td className={`py-1.5 pr-3 whitespace-nowrap ${row.isAverage ? "font-medium text-muted" : ""}`}>
                {row.href ? (
                  <Link href={row.href} className="hover:text-accent-hover transition-colors">
                    {row.name}
                  </Link>
                ) : (
                  row.name
                )}
                {row.sub && <span className="ml-2 text-xs text-muted">{row.sub}</span>}
              </td>
              {row.cells.map((v, i) => (
                <td key={i} className="px-1 py-1">
                  <div
                    className={`rounded-md text-center py-1.5 text-xs font-medium tabular-nums ${cellTint(v)} ${row.isAverage ? "opacity-90" : ""}`}
                    title={v != null ? `${row.name} — ${dimensions[i]?.name}: ${v.toFixed(2)} / 5` : "No graded activity in the last 30 days"}
                  >
                    {v != null ? v.toFixed(1) : "–"}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-4 mt-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400/40" /> 4.0+
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-400/40" /> 3.0–3.9
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400/40" /> 2.5–2.9
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-400/40" /> below 2.5
        </span>
        <span>Average dimension score, last 30 days</span>
      </div>
    </div>
  );
}
