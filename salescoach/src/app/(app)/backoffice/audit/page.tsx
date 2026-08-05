import Link from "next/link";
import { db } from "@/lib/db";
import { backofficeActor } from "@/lib/backoffice";
import { PageHeader, Card, EmptyState, fmtDateTime } from "@/components/ui";

const ACTION_FILTERS = [
  "ALL",
  "USER_CREATED",
  "USER_ROLE_CHANGED",
  "USER_PASSWORD_RESET",
  "USER_DISABLED",
  "USER_ENABLED",
  "USER_LOGIN",
  "PLAN_CHANGED",
  "CUSTOMIZATION_CHANGED",
  "DATA_EXPORTED",
  "IMPERSONATION_STARTED",
  "PII_REVEALED",
];

function metaSummary(metaJson: string): string {
  try {
    const meta = JSON.parse(metaJson) as Record<string, unknown>;
    return Object.entries(meta)
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
      .join(" · ");
  } catch {
    return "";
  }
}

export default async function BackofficeAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const actor = (await backofficeActor())!;
  const { action } = await searchParams;
  const filter = ACTION_FILTERS.includes(action?.toUpperCase() ?? "") ? action!.toUpperCase() : "ALL";

  const events = await db.auditEvent.findMany({
    where: { orgId: actor.user.orgId, ...(filter === "ALL" ? {} : { action: filter }) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Audit"
        subtitle="Append-only record of administrative actions in this organization — seat changes, plan changes, exports, and vendor staff access. Nothing here can be edited or deleted."
      />

      <div className="flex flex-wrap gap-1.5 mb-4">
        {ACTION_FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "ALL" ? "/backoffice/audit" : `/backoffice/audit?action=${f}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === f
                ? "border-accent text-accent-hover bg-accent/10"
                : "border-line text-muted hover:text-foreground"
            }`}
          >
            {f.replaceAll("_", " ")}
          </Link>
        ))}
      </div>

      <Card>
        {events.length === 0 ? (
          <EmptyState
            title="No audit events match this filter"
            hint="Administrative actions (team, plan, exports) appear here as they happen."
          />
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{event.action.replaceAll("_", " ")}</span>
                  <span className="text-xs text-muted">
                    {event.actorEmail}
                    {event.consoleRole && (
                      <span className="text-amber-300/90"> (vendor staff)</span>
                    )}
                    {" · "}
                    {fmtDateTime(event.createdAt)}
                    {event.ip && ` · ${event.ip}`}
                  </span>
                </div>
                {metaSummary(event.metaJson) && (
                  <div className="text-xs text-muted mt-1">{metaSummary(event.metaJson)}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
