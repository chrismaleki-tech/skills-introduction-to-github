import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, Card, EmptyState, fmtDateTime } from "@/components/ui";

const ACTION_FILTERS = [
  "ALL",
  "ORG_CREATED",
  "USER_CREATED",
  "USER_PASSWORD_RESET",
  "USER_ROLE_CHANGED",
  "IMPERSONATION_STARTED",
  "PII_REVEALED",
  "CONSOLE_ELEVATED",
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

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const filter = ACTION_FILTERS.includes(action?.toUpperCase() ?? "") ? action!.toUpperCase() : "ALL";

  const [events, orgs] = await Promise.all([
    db.auditEvent.findMany({
      where: filter === "ALL" ? undefined : { action: filter },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.org.findMany({ select: { id: true, name: true } }),
  ]);
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  return (
    <div>
      <PageHeader
        title="Audit trail"
        subtitle="Append-only record of every console action: who, what, when, which tenant. No edit or delete path exists."
      />

      <div className="flex flex-wrap gap-1.5 mb-4">
        {ACTION_FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "ALL" ? "/admin/audit" : `/admin/audit?action=${f}`}
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
          <EmptyState title="No audit events match this filter" />
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{event.action.replaceAll("_", " ")}</span>
                  <span className="text-xs text-muted">
                    {event.actorEmail}
                    {event.consoleRole && ` (${event.consoleRole.toLowerCase()})`}
                    {" · "}
                    {fmtDateTime(event.createdAt)}
                    {event.orgId && ` · ${orgName.get(event.orgId) ?? event.orgId}`}
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
