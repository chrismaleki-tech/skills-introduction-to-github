import { backofficeActor } from "@/lib/backoffice";
import { PageHeader, Card } from "@/components/ui";

const EXPORTS: { entity: string; label: string; blurb: string }[] = [
  { entity: "users", label: "Team seats", blurb: "Names, emails, roles, seat status, last login." },
  { entity: "accounts", label: "CRM accounts", blurb: "Companies with domain, industry, and size." },
  { entity: "contacts", label: "CRM contacts", blurb: "People with email, phone, and account." },
  { entity: "deals", label: "Pipeline deals", blurb: "Stage, amount, probability, owner, close date." },
  { entity: "calls", label: "Calls", blurb: "Call log with rep, prospect, type, and duration." },
  { entity: "grades", label: "Coaching grades", blurb: "Scores, bands, and manager overrides." },
  { entity: "usage", label: "Usage events", blurb: "Raw metered events behind your statement." },
  { entity: "audit", label: "Audit trail", blurb: "Administrative actions recorded for this org." },
];

export default async function BackofficeExportsPage() {
  await backofficeActor();
  return (
    <div>
      <PageHeader
        title="Exports"
        subtitle="Download your business data as CSV. Your data is yours — no lock-in. Every export is recorded in the audit trail."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {EXPORTS.map((exp) => (
          <Card key={exp.entity} title={exp.label}>
            <p className="text-xs text-muted mb-3 min-h-8">{exp.blurb}</p>
            <a
              href={`/api/backoffice/export?entity=${exp.entity}`}
              className="inline-flex items-center rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium hover:text-foreground hover:border-accent/50 transition-colors"
              download
            >
              Download CSV
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
}
