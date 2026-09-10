import type { Grade } from "@prisma/client";
import {
  parseDimensionScores,
  parseMechanics,
  parseStringArray,
} from "@/lib/types";
import { BandPill, Card, ScoreBadge } from "./ui";

// Shared grade scorecard, rendered identically for uploaded calls and
// role-plays so both activity types read on the same 0-100 scale.

export function GradeView({ grade }: { grade: Grade }) {
  const dims = parseDimensionScores(grade.dimensionScoresJson);
  const mech = parseMechanics(grade.mechanicsJson);
  const strengths = parseStringArray(grade.strengthsJson);
  const improvements = parseStringArray(grade.improvementsJson);
  const effective = grade.managerOverrideScore ?? grade.overallScore;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <ScoreBadge score={effective} size="lg" />
          <div className="flex-1 min-w-48">
            <div className="flex items-center gap-2">
              <BandPill score={effective} />
              {grade.managerOverrideScore != null && (
                <span className="text-xs text-amber-700">
                  Manager override (AI scored {grade.overallScore})
                </span>
              )}
            </div>
            <p className="text-sm text-muted mt-2">{grade.summary}</p>
          </div>
          <div className="text-right text-xs text-muted">
            <div>Graded by {grade.gradedBy === "mock" ? "heuristic engine (demo mode)" : grade.gradedBy}</div>
            <div>{new Date(grade.createdAt).toLocaleString()}</div>
          </div>
        </div>
        {grade.managerComment && (
          <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm">
            <span className="font-medium text-amber-700">Manager note: </span>
            {grade.managerComment}
          </div>
        )}
      </Card>

      <Card title="Rubric dimensions">
        <div className="space-y-4">
          {dims.map((d) => (
            <div key={d.key} className="border-b border-line last:border-0 pb-4 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-sm">{d.name}</div>
                <div className="flex items-center gap-2 shrink-0">
                  <DimensionDots score={d.score} />
                  <span className="text-sm tabular-nums text-muted">{d.score}/5</span>
                </div>
              </div>
              <p className="text-sm text-muted mt-1">{d.rationale}</p>
              {d.quotes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {d.quotes.map((q, i) => (
                    <blockquote key={i} className="text-xs text-foreground/70 border-l-2 border-brand/50 pl-2 italic">
                      <span className="text-muted not-italic mr-1.5 tabular-nums">{fmtTs(q.atSec)}</span>
                      &ldquo;{q.text}&rdquo;
                    </blockquote>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Strengths">
          <ul className="space-y-2 text-sm">
            {strengths.length === 0 && <li className="text-muted">None identified at 4+ this time.</li>}
            {strengths.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-emerald-700 shrink-0">+</span>
                {s}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Work on next">
          <ul className="space-y-2 text-sm">
            {improvements.length === 0 && <li className="text-muted">Nothing scored 3 or below.</li>}
            {improvements.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-amber-700 shrink-0">→</span>
                {s}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Mechanics (informational — not part of the score)">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
          <Mech label="Talk ratio" value={`${Math.round(mech.talkRatio * 100)}%`} warn={mech.talkRatio > 0.65} />
          <Mech label="Questions" value={String(mech.questionCount)} warn={mech.questionCount < 3} />
          <Mech label="Longest monologue" value={`${mech.longestMonologueSec}s`} warn={mech.longestMonologueSec > 90} />
          <Mech label="Filler words" value={String(mech.fillerWords)} warn={mech.fillerWords > 8} />
          <Mech label="Interruptions" value={String(mech.interruptions)} warn={mech.interruptions > 2} />
        </div>
      </Card>
    </div>
  );
}

function DimensionDots({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${i <= score ? "bg-brand" : "bg-line"}`}
        />
      ))}
    </div>
  );
}

function Mech({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div className={`text-xl font-semibold tabular-nums ${warn ? "text-amber-700" : ""}`}>{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}

function fmtTs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
