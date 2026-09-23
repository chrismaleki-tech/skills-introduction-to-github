import type { Mechanics, TranscriptSegment } from "./types";

const FILLERS = /\b(um+|uh+|like,|you know|i mean|kind of|sort of|basically|actually)\b/gi;

// Mechanical metrics computed directly from the transcript. These are
// deterministic and methodology-independent; they are displayed alongside the
// rubric grade but never feed the 0-100 score.
export function computeMechanics(segments: TranscriptSegment[]): Mechanics {
  let repWords = 0;
  let prospectWords = 0;
  let questionCount = 0;
  let fillerWords = 0;
  let interruptions = 0;
  let longestMonologueSec = 0;

  let monologueStart: number | null = null;
  let monologueEnd = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const words = seg.text.split(/\s+/).filter(Boolean).length;

    if (seg.speaker === "rep") {
      repWords += words;
      questionCount += (seg.text.match(/\?/g) ?? []).length;
      fillerWords += (seg.text.match(FILLERS) ?? []).length;

      if (monologueStart === null) monologueStart = seg.startSec;
      monologueEnd = seg.endSec;

      const prev = segments[i - 1];
      // Speaking within half a second of (or overlapping) the prospect's turn
      // is counted as an interruption.
      if (prev && prev.speaker === "prospect" && seg.startSec < prev.endSec + 0.5) {
        interruptions++;
      }
    } else {
      if (monologueStart !== null) {
        longestMonologueSec = Math.max(longestMonologueSec, monologueEnd - monologueStart);
        monologueStart = null;
      }
      prospectWords += words;
    }
  }
  if (monologueStart !== null) {
    longestMonologueSec = Math.max(longestMonologueSec, monologueEnd - monologueStart);
  }

  const total = repWords + prospectWords;
  return {
    talkRatio: total > 0 ? Math.round((repWords / total) * 100) / 100 : 0,
    questionCount,
    longestMonologueSec: Math.round(longestMonologueSec),
    fillerWords,
    interruptions,
  };
}
