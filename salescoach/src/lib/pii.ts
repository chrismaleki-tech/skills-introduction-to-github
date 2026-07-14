import type { TranscriptSegment } from "./types";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE =
  /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const CC_RE = /\b(?:\d[ -]*?){13,19}\b/g;

export interface RetentionPolicy {
  redactPiiInTranscripts: boolean;
  redactPiiInEmailBodies: boolean;
  retainCallDays: number; // 0 = keep forever
  retainEmailDays: number;
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  redactPiiInTranscripts: true,
  redactPiiInEmailBodies: true,
  retainCallDays: 365,
  retainEmailDays: 365,
};

export function parseRetentionPolicy(json: string | null | undefined): RetentionPolicy {
  if (!json) return { ...DEFAULT_RETENTION_POLICY };
  try {
    return { ...DEFAULT_RETENTION_POLICY, ...(JSON.parse(json) as Partial<RetentionPolicy>) };
  } catch {
    return { ...DEFAULT_RETENTION_POLICY };
  }
}

/** Best-effort PII scrubbing for transcripts and email bodies. */
export function redactPii(text: string): string {
  if (!text) return text;
  return text
    .replace(EMAIL_RE, "[REDACTED_EMAIL]")
    .replace(SSN_RE, "[REDACTED_SSN]")
    .replace(CC_RE, "[REDACTED_CARD]")
    .replace(PHONE_RE, "[REDACTED_PHONE]");
}

export function redactSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.map((s) => ({ ...s, text: redactPii(s.text) }));
}
