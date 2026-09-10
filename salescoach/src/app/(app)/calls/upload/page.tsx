import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { UploadForm } from "@/components/calls/upload-form";

const WEBHOOK_EXAMPLE = `curl -X POST https://your-host/api/ingest/webhook \\
  -H "Content-Type: application/json" \\
  -d '{
    "secret": "<org webhook secret>",
    "repEmail": "rep@yourcompany.com",
    "externalId": "provider-call-8421",
    "durationSec": 540,
    "direction": "outbound",
    "callType": "discovery",
    "prospectName": "Acme Logistics",
    "callDate": "2026-07-01T15:04:00Z",
    "transcript": "REP: Hi, this is Jordan...\\nPROSPECT: Go ahead."
  }'`;

export default async function UploadCallPage() {
  const user = await currentUser();
  const reps = isManagerRole(user.role)
    ? await db.user.findMany({
        where: { orgId: user.orgId, role: "REP" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Upload a call"
        subtitle="Manual uploads are always graded — they bypass the sampling policy."
      />

      <Card>
        <UploadForm reps={reps} currentUserId={user.id} />
      </Card>

      <Card title="Automatic ingestion" className="mt-6">
        <details>
          <summary className="cursor-pointer text-sm text-muted hover:text-foreground transition-colors">
            Connect a dialer or call provider via the ingestion webhook
          </summary>
          <div className="mt-3 space-y-3 text-sm text-muted">
            <p>
              Providers push finished calls to the webhook below. Each call is matched to a rep by
              email, deduplicated on <code className="text-foreground/80">externalId</code>, and run
              through the sampling policy — the response tells you whether it was graded and why.
              The <code className="text-foreground/80">transcript</code> field is optional (REP:/PROSPECT:
              lines or a JSON segments array); without it, audio-less calls fall back to the demo engine.
            </p>
            <pre className="rounded-lg border border-line bg-surface-2 p-4 text-xs overflow-x-auto text-foreground/90">
              {WEBHOOK_EXAMPLE}
            </pre>
            <p>The webhook secret for your organization lives in Settings.</p>
          </div>
        </details>
      </Card>
    </div>
  );
}
