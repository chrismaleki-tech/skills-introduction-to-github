import type { TranscriptSegment } from "./types";

// Transcription front door. Three paths:
//   1. "provided" — the caller already has a transcript (.txt / .json upload,
//      webhook payload, or a role-play transcript). Parsed, not billed.
//   2. Deepgram batch transcription with diarization when DEEPGRAM_API_KEY is set.
//   3. Mock — deterministic generated transcript so the pipeline stays
//      demoable with no keys. Clearly labeled engine: "mock".

export interface TranscriptionResult {
  segments: TranscriptSegment[];
  engine: "deepgram" | "provided" | "mock";
}

export function transcriptionAvailable(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY);
}

// --- Path 1: provided transcripts ---

// Accepts either a JSON array of segments or plain text with "REP:" /
// "PROSPECT:" (or "AGENT:" / "CUSTOMER:") speaker prefixes per line.
export function parseProvidedTranscript(raw: string): TranscriptSegment[] {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as Partial<TranscriptSegment>[];
      return arr
        .filter((s) => typeof s.text === "string")
        .map((s, i) => ({
          speaker: s.speaker === "prospect" ? "prospect" : "rep",
          startSec: Number(s.startSec ?? i * 15),
          endSec: Number(s.endSec ?? i * 15 + 12),
          text: String(s.text),
        }));
    } catch {
      // fall through to line parsing
    }
  }
  const lines = trimmed.split("\n").filter((l) => l.trim());
  const segments: TranscriptSegment[] = [];
  let t = 0;
  for (const line of lines) {
    const m = line.match(/^\s*(rep|agent|seller|prospect|customer|buyer)\s*[:\-]\s*(.+)$/i);
    if (!m) continue;
    const isRep = /rep|agent|seller/i.test(m[1]);
    const text = m[2].trim();
    const dur = Math.max(3, Math.min(45, text.split(/\s+/).length * 0.45));
    segments.push({ speaker: isRep ? "rep" : "prospect", startSec: t, endSec: t + dur, text });
    t += dur + 0.8;
  }
  return segments;
}

// --- Path 2: Deepgram ---

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  speaker?: number;
  punctuated_word?: string;
}

export async function transcribeAudio(audio: Buffer, mimeType: string): Promise<TranscriptionResult> {
  if (!transcriptionAvailable()) {
    return { segments: mockTranscript(audio.length), engine: "mock" };
  }
  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&diarize=true&punctuate=true&utterances=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": mimeType,
      },
      body: new Uint8Array(audio),
    },
  );
  if (!res.ok) throw new Error(`Deepgram error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    results?: {
      utterances?: { start: number; end: number; speaker: number; transcript: string }[];
      channels?: { alternatives?: { words?: DeepgramWord[] }[] }[];
    };
  };

  const utterances = data.results?.utterances ?? [];
  // Heuristic: the speaker with more total words is assumed to be the rep.
  // The review UI lets a human swap speakers if diarization got it backwards.
  const wordTotals = new Map<number, number>();
  for (const u of utterances) {
    wordTotals.set(u.speaker, (wordTotals.get(u.speaker) ?? 0) + u.transcript.split(/\s+/).length);
  }
  const repSpeaker = [...wordTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;

  return {
    segments: utterances.map((u) => ({
      speaker: u.speaker === repSpeaker ? "rep" : "prospect",
      startSec: u.start,
      endSec: u.end,
      text: u.transcript,
    })),
    engine: "deepgram",
  };
}

// --- Path 3: mock ---

// Industry-neutral so demo-mode transcription never leaks another tenant's
// company or product names into a customer's workspace.
const MOCK_EXCHANGES: [string, string][] = [
  [
    "Hi, this is Jordan — did I catch you at an okay time?",
    "You've got about two minutes, go ahead.",
  ],
  [
    "Appreciate that. Before I say anything about us — how is your team handling this today, and what's working about it?",
    "Mostly manual processes and a legacy system, honestly. It's not great but it works.",
  ],
  [
    "That's what we hear a lot. When it goes wrong, what does it end up costing you — time, money, or customers?",
    "Customers, mostly. We had a rough quarter with one of our biggest accounts over exactly that.",
  ],
  [
    "That's a big deal. What would it mean for that relationship if the problem just went away?",
    "It would help, sure. But look, we've been burned by vendors before. These things drag on and go over budget.",
  ],
  [
    "Totally fair — that's the most common concern we hear. We roll out in phases with a fixed scope up front. Would it be useful if I showed you how a company your size did it?",
    "Maybe. What does something like this cost?",
  ],
  [
    "It depends on scope, but against what that account issue cost you, most customers see the math work in the first quarter. Could we set up thirty minutes Thursday with you and whoever owns the budget, and I'll walk through the numbers?",
    "Alright, Thursday afternoon could work. Send me an invite.",
  ],
];

export function mockTranscript(seed: number): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let t = 2;
  const count = 3 + (Math.abs(seed) % (MOCK_EXCHANGES.length - 2));
  for (let i = 0; i <= count && i < MOCK_EXCHANGES.length; i++) {
    const [rep, prospect] = MOCK_EXCHANGES[i];
    const repDur = rep.split(/\s+/).length * 0.42;
    segments.push({ speaker: "rep", startSec: t, endSec: t + repDur, text: rep });
    t += repDur + 0.7;
    const proDur = prospect.split(/\s+/).length * 0.45;
    segments.push({ speaker: "prospect", startSec: t, endSec: t + proDur, text: prospect });
    t += proDur + 0.9;
  }
  return segments;
}
