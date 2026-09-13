import type { TranscriptSegment } from "@/lib/types";
import { Card } from "./ui";

// Shared transcript renderer for call review and role-play review pages.
export function TranscriptView({
  segments,
  repName,
  prospectName,
}: {
  segments: TranscriptSegment[];
  repName: string;
  prospectName?: string;
}) {
  return (
    <Card title="Transcript">
      <div className="space-y-3 max-h-[36rem] overflow-y-auto pr-1">
        {segments.map((s, i) => (
          <div key={i} className={`flex gap-3 ${s.speaker === "rep" ? "" : "flex-row-reverse"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                s.speaker === "rep"
                  ? "bg-accent/15 border border-accent/20"
                  : "bg-surface-2 border border-line"
              }`}
            >
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className={`text-xs font-medium ${s.speaker === "rep" ? "text-accent-hover" : "text-muted"}`}>
                  {s.speaker === "rep" ? repName : (prospectName || "Prospect")}
                </span>
                <span className="text-[10px] text-muted tabular-nums">{fmtTs(s.startSec)}</span>
              </div>
              {s.text}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function fmtTs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
