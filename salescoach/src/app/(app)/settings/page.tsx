import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { aiAvailable } from "@/lib/ai";
import { currentUser, isManagerRole } from "@/lib/session";
import { parseIngestionPolicy } from "@/lib/types";
import { parseRetentionPolicy } from "@/lib/pii";
import { BandPill, Card, PageHeader } from "@/components/ui";
import { OrgNameForm } from "@/components/settings/org-name-form";
import { PolicyForm } from "@/components/settings/policy-form";
import { WebhookCard } from "@/components/settings/webhook-card";
import { RetentionForm, UnmatchedQueue } from "@/components/settings/compliance";

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
  const retention = parseRetentionPolicy(org.retentionPolicyJson);
  const activeMethodology = org.activeMethodologyId
    ? await db.methodology.findUnique({ where: { id: org.activeMethodologyId } })
    : null;

  const [unmatched, reps] = await Promise.all([
    db.unmatchedIngest.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.user.findMany({
      where: { orgId: org.id },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const engines = [
    { label: "OpenAI (grading & role-play)", envVar: "OPENAI_API_KEY", ok: aiAvailable() },
    {
      label: "Deepgram (call transcription)",
      envVar: "DEEPGRAM_API_KEY",
      ok: Boolean(process.env.DEEPGRAM_API_KEY),
    },
    {
      label: "Vapi (voice role-play)",
      envVar: "VAPI_WEBHOOK_SECRET",
      ok: Boolean(process.env.VAPI_WEBHOOK_SECRET),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Team Settings"
        subtitle="Ingestion, compliance, unmatched webhooks, engines, and scoring reference."
      />
      <div className="space-y-6">
        <Card title="Ingestion & sampling policy">
          <PolicyForm policy={policy} />
        </Card>

        <Card title="PII & retention">
          <RetentionForm policy={retention} />
        </Card>

        <Card
          title="Unmatched webhook calls"
          action={
            <span className="text-xs text-muted">
              {unmatched.filter((u) => u.status === "PENDING").length} pending
            </span>
          }
        >
          <UnmatchedQueue items={unmatched} reps={reps} />
        </Card>

        <Card title="Automatic ingestion">
          <WebhookCard secret={org.webhookSecret} />
        </Card>

        <Card title="Grading engine">
          <ul className="space-y-2">
            {engines.map((engine) => (
              <li key={engine.envVar} className="flex flex-wrap items-center gap-2 text-sm">
                <span>{engine.label}</span>
                <code className="text-[11px] text-muted bg-surface-2 border border-line rounded px-1.5 py-0.5">
                  {engine.envVar}
                </code>
                {engine.ok ? (
                  <span className="ml-auto text-emerald-400">configured</span>
                ) : (
                  <span className="ml-auto text-amber-400">not set — demo engine active</span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-line pt-4 text-sm">
            <span className="text-muted">Active methodology: </span>
            {activeMethodology ? (
              <Link href="/rubrics" className="text-accent-hover hover:underline">
                {activeMethodology.name}
              </Link>
            ) : (
              <Link href="/rubrics" className="text-amber-400 hover:underline">
                none set — choose one in Rubrics
              </Link>
            )}
            <div className="mt-2">
              <Link href="/calibration" className="text-accent-hover hover:underline text-sm">
                Open grading calibration →
              </Link>
            </div>
          </div>
        </Card>

        <Card title="Organization">
          <OrgNameForm name={org.name} />
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
