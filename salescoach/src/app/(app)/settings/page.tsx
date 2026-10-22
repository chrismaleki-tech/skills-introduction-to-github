import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { parseIngestionPolicy } from "@/lib/types";
import { BandPill, Card, PageHeader } from "@/components/ui";
import { OrgNameForm } from "@/components/settings/org-name-form";
import { PolicyForm } from "@/components/settings/policy-form";
import { WebhookCard } from "@/components/settings/webhook-card";

const SCORE_BANDS = [
  { range: "90+", label: "Exceptional", sample: 95 },
  { range: "75-89", label: "Strong", sample: 82 },
  { range: "60-74", label: "Developing", sample: 67 },
  { range: "<60", label: "Needs coaching", sample: 45 },
];

export default async function SettingsPage() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) redirect("/me");

  const org = user.org;
  const policy = parseIngestionPolicy(org.ingestionPolicyJson);
  const activeMethodology = org.activeMethodologyId
    ? await db.methodology.findUnique({ where: { id: org.activeMethodologyId } })
    : null;

  return (
    <div>
      <PageHeader
        title="Team Settings"
        subtitle="Ingestion policy, automatic call ingestion, and scoring reference for your team."
      />
      <div className="space-y-6">
        <Card title="Ingestion & sampling policy">
          <PolicyForm policy={policy} />
        </Card>

        <Card title="Automatic ingestion">
          <WebhookCard secret={org.webhookSecret} />
        </Card>

        <Card title="Organization">
          <OrgNameForm name={org.name} />
          <div className="mt-5 border-t border-line pt-4 text-sm">
            <span className="text-muted">Active methodology: </span>
            {activeMethodology ? (
              <Link href="/rubrics" className="text-brand hover:underline">
                {activeMethodology.name}
              </Link>
            ) : (
              <Link href="/rubrics" className="text-amber-700 hover:underline">
                none set — choose one in Rubrics
              </Link>
            )}
          </div>
        </Card>

        <Card title="Data retention">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Call audio</dt>
              <dd className="mt-1 font-medium">{org.audioRetentionDays} days</dd>
            </div>
            <div>
              <dt className="text-muted">Transcripts, scores, and role-plays</dt>
              <dd className="mt-1 font-medium">{org.dataRetentionDays} days</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted">
            Managers and call owners can delete individual calls immediately from the call review page.
          </p>
        </Card>

        <Card title="Score bands reference">
          <p className="text-sm text-muted mb-4">
            Every grade rolls up to a 0-100 score from the weighted rubric dimensions, then lands in one of
            four bands.
          </p>
          <ul className="space-y-2">
            {SCORE_BANDS.map((band) => (
              <li key={band.range} className="flex items-center gap-3 text-sm">
                <span className="w-14 tabular-nums text-muted">{band.range}</span>
                <BandPill score={band.sample} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
