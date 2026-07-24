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

/** PII masking for the platform console: show shape, hide content. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "•••";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const domainName = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local[0]}${"•".repeat(Math.max(2, local.length - 1))}@${domainName[0] ?? ""}${"•".repeat(
    Math.max(2, domainName.length - 1),
  )}${tld}`;
}
