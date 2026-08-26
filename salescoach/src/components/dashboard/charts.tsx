// Chart primitives for the dashboard slice. Inline SVG / styled divs only —
// no chart library. All are server-renderable (no client hooks).

const CALL_COLOR = "#00a4bd"; // HubSpot Calypso
const ROLEPLAY_COLOR = "#516f90"; // HubSpot slate blue

export interface WeekPoint {
  label: string; // e.g. "May 12"
  call: number | null; // avg effective score 0-100, null = no grades
  roleplay: number | null;
}

export function ChartLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CALL_COLOR }} />
        Calls
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ROLEPLAY_COLOR }} />
        Role-plays
      </span>
    </div>
  );
}

// Grouped bar chart: one pair of bars (calls / role-plays) per week, y = 0-100.
export function WeeklyTrendChart({ weeks }: { weeks: WeekPoint[] }) {
  const W = 640;
  const H = 200;
  const padL = 34;
  const padB = 22;
  const padT = 8;
  const plotW = W - padL - 8;
  const plotH = H - padT - padB;
  const slot = plotW / Math.max(weeks.length, 1);
  const barW = Math.min(18, slot / 3);
  const y = (score: number) => padT + plotH - (score / 100) * plotH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Weekly average score, calls vs role-plays">
      {[0, 50, 100].map((tick) => (
        <g key={tick}>
          <line x1={padL} x2={W - 8} y1={y(tick)} y2={y(tick)} stroke="#2a455c" strokeWidth={1} />
          <text x={padL - 6} y={y(tick) + 3.5} textAnchor="end" fontSize={10} fill="#7c98b3">
            {tick}
          </text>
        </g>
      ))}
      {weeks.map((w, i) => {
        const cx = padL + slot * i + slot / 2;
        return (
          <g key={i}>
            {w.call != null && (
              <rect x={cx - barW - 1.5} y={y(w.call)} width={barW} height={Math.max(2, padT + plotH - y(w.call))} rx={2} fill={CALL_COLOR}>
                <title>{`Week of ${w.label} — calls avg ${Math.round(w.call)}`}</title>
              </rect>
            )}
            {w.roleplay != null && (
              <rect x={cx + 1.5} y={y(w.roleplay)} width={barW} height={Math.max(2, padT + plotH - y(w.roleplay))} rx={2} fill={ROLEPLAY_COLOR}>
                <title>{`Week of ${w.label} — role-plays avg ${Math.round(w.roleplay)}`}</title>
              </rect>
            )}
            {w.call == null && w.roleplay == null && (
              <text x={cx} y={y(0) - 4} textAnchor="middle" fontSize={10} fill="#7c98b3">
                –
              </text>
            )}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize={10} fill="#7c98b3">
              {w.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface TimelinePoint {
  t: number; // epoch ms
  score: number; // effective score 0-100
  type: string; // CALL | ROLEPLAY
  label: string; // tooltip text
}

// Scatter over a fixed time window with a faint connecting line, band guides
// at 60 / 75 / 90. Renders sensibly with a single point.
export function ScoreTimeline({ points, start, end }: { points: TimelinePoint[]; start: number; end: number }) {
  const W = 640;
  const H = 190;
  const padL = 34;
  const padB = 20;
  const padT = 8;
  const plotW = W - padL - 12;
  const plotH = H - padT - padB;
  const span = Math.max(end - start, 1);
  const x = (t: number) => padL + ((t - start) / span) * plotW;
  const y = (score: number) => padT + plotH - (score / 100) * plotH;
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const line = sorted.map((p) => `${x(p.t).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
  const midLabel = start + span / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Score history over time">
      {[0, 60, 75, 90].map((tick) => (
        <g key={tick}>
          <line
            x1={padL}
            x2={W - 12}
            y1={y(tick)}
            y2={y(tick)}
            stroke="#2a455c"
            strokeWidth={1}
            strokeDasharray={tick === 0 ? undefined : "3 4"}
          />
          <text x={padL - 6} y={y(tick) + 3.5} textAnchor="end" fontSize={10} fill="#7c98b3">
            {tick}
          </text>
        </g>
      ))}
      {sorted.length > 1 && <polyline points={line} fill="none" stroke="#7c98b3" strokeOpacity={0.35} strokeWidth={1.5} />}
      {sorted.map((p, i) => (
        <circle key={i} cx={x(p.t)} cy={y(p.score)} r={4.5} fill={p.type === "CALL" ? CALL_COLOR : ROLEPLAY_COLOR} fillOpacity={0.9}>
          <title>{p.label}</title>
        </circle>
      ))}
      {[start, midLabel, end].map((t, i) => (
        <text
          key={i}
          x={x(t)}
          y={H - 5}
          textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
          fontSize={10}
          fill="#7c98b3"
        >
          {new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </text>
      ))}
    </svg>
  );
}

export interface PairedBarRow {
  name: string;
  primary: number | null; // 1-5
  secondary: number | null; // 1-5
}

// Horizontal paired bars on a 1-5 scale: rep (accent) vs team (slate).
export function PairedBars({
  rows,
  primaryLabel,
  secondaryLabel,
}: {
  rows: PairedBarRow[];
  primaryLabel: string;
  secondaryLabel: string;
}) {
  const width = (v: number | null) => (v == null ? 0 : Math.max(2, (v / 5) * 100));
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent-hover" />
          {primaryLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-500" />
          {secondaryLabel}
        </span>
      </div>
      {rows.map((row) => (
        <div key={row.name}>
          <div className="flex items-baseline justify-between text-sm mb-1.5">
            <span>{row.name}</span>
            <span className="text-xs text-muted tabular-nums">
              {row.primary != null ? row.primary.toFixed(1) : "–"} vs {row.secondary != null ? row.secondary.toFixed(1) : "–"}
            </span>
          </div>
          <div className="space-y-1">
            <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
              {row.primary != null && (
                <div className="h-full rounded-full bg-accent-hover" style={{ width: `${width(row.primary)}%` }} />
              )}
            </div>
            <div className="h-2.5 rounded-full bg-surface-2 overflow-hidden">
              {row.secondary != null && (
                <div className="h-full rounded-full bg-slate-500" style={{ width: `${width(row.secondary)}%` }} />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Up/down/flat indicator vs a prior period.
export function TrendArrow({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-xs text-muted">no prior data</span>;
  const rounded = Math.round(delta);
  if (rounded > 0)
    return <span className="text-xs font-medium text-emerald-400 tabular-nums">▲ {rounded}</span>;
  if (rounded < 0)
    return <span className="text-xs font-medium text-rose-400 tabular-nums">▼ {Math.abs(rounded)}</span>;
  return <span className="text-xs text-muted">– 0</span>;
}
