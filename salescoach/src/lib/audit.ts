import { db } from "./db";

/**
 * Append-only audit trail for platform-console actions.
 * The app exposes no update/delete path for AuditEvent rows; writes must go
 * through recordAudit so every entry carries actor + target + tenant context.
 */

export type AuditAction =
  | "ORG_CREATED"
  | "USER_CREATED"
  | "USER_PASSWORD_RESET"
  | "USER_ROLE_CHANGED"
  | "JOB_RETRIED"
  | "JOBS_DRAINED"
  | "PRESETS_INSTALLED"
  | "CONSOLE_ELEVATED"
  | "CONSOLE_ELEVATION_DENIED"
  | "IMPERSONATION_STARTED"
  | "IMPERSONATION_ENDED"
  | "PII_REVEALED";

export function requestIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "";
}

export async function recordAudit(input: {
  actor: { id?: string | null; email: string };
  consoleRole?: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string | null;
  orgId?: string | null;
  req?: Request;
  meta?: Record<string, unknown>;
}) {
  // Unlike usage metering, audit is a control: if we cannot record the action,
  // the caller should fail rather than proceed unaudited — so no try/catch.
  await db.auditEvent.create({
    data: {
      actorId: input.actor.id ?? null,
      actorEmail: input.actor.email,
      consoleRole: input.consoleRole ?? "",
      action: input.action,
      targetType: input.targetType ?? "",
      targetId: input.targetId ?? null,
      orgId: input.orgId ?? null,
      ip: input.req ? requestIp(input.req) : "",
      metaJson: JSON.stringify(input.meta ?? {}),
    },
  });
}
