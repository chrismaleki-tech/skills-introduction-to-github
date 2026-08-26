"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

// Automatic ingestion card body: webhook endpoint, copyable secret, rotation,
// and a complete curl example for wiring up a dialer or call recorder.

// Hydration-safe read of the deployment origin (empty on the server).
const noopSubscribe = () => () => {};
function useOrigin() {
  return useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
}

export function WebhookCard({ secret }: { secret: string }) {
  const router = useRouter();
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState("");

  const url = `${origin || "https://your-deployment"}/api/ingest/webhook`;

  async function copySecret() {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function rotate() {
    if (
      !confirm(
        "Rotate the webhook secret? Calls sent with the old secret will be rejected until every integration is updated.",
      )
    )
      return;
    setRotating(true);
    setError("");
    const res = await fetch("/api/settings/rotate-secret", { method: "POST" });
    setRotating(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Could not rotate the secret.");
      return;
    }
    router.refresh();
  }

  const curlExample = `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -d '{
    "secret": "${secret}",
    "repEmail": "rep@yourcompany.com",
    "externalId": "call_1042",
    "durationSec": 540,
    "callType": "discovery",
    "prospectName": "Dana Whitfield",
    "transcript": "Rep: Hi Dana, thanks for taking the time...\\nProspect: Sure, what is this about?"
  }'`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Point your dialer or call recorder at this endpoint and every call flows in automatically, subject to
        the sampling policy above.
      </p>
      <div>
        <div className="text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Webhook URL</div>
        <code className="block bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm font-mono break-all">
          {url}
        </code>
      </div>
      <div>
        <div className="text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Webhook secret</div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 min-w-0 bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm font-mono break-all">
            {secret}
          </code>
          <Button variant="secondary" onClick={copySecret}>
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="danger" onClick={rotate} disabled={rotating}>
            {rotating ? "Rotating…" : "Rotate secret"}
          </Button>
        </div>
        {error && <p className="text-xs text-rose-400 mt-1.5">{error}</p>}
      </div>
      <div>
        <div className="text-xs font-medium text-muted uppercase tracking-wider mb-1.5">Example request</div>
        <pre className="bg-surface-2 border border-line rounded-lg px-3 py-3 text-xs font-mono overflow-x-auto leading-relaxed">
          {curlExample}
        </pre>
      </div>
    </div>
  );
}
