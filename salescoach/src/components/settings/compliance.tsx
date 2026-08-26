"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";

export function UnmatchedQueue({
  items,
  reps,
}: {
  items: {
    id: string;
    repEmail: string;
    source: string;
    externalId: string | null;
    status: string;
    createdAt: string | Date;
    resolvedCallId: string | null;
  }[];
  reps: { id: string; name: string; email: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [map, setMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "resolve" | "dismiss") {
    setError(null);
    const res = await fetch("/api/ingest/unmatched", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, repId: map[id] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Action failed.");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted">No unmatched webhook calls. New ones appear here automatically.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.id} className="py-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="text-sm font-medium">{item.repEmail}</div>
              <div className="text-xs text-muted">
                {item.source} · {item.externalId || "no external id"} · {item.status} ·{" "}
                {new Date(item.createdAt).toLocaleString()}
              </div>
            </div>
            {item.status === "PENDING" ? (
              <>
                <select
                  className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm"
                  value={map[item.id] ?? ""}
                  onChange={(e) => setMap((m) => ({ ...m, [item.id]: e.target.value }))}
                >
                  <option value="">Map to rep…</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.email})
                    </option>
                  ))}
                </select>
                <Button type="button" disabled={pending || !map[item.id]} onClick={() => act(item.id, "resolve")}>
                  Resolve
                </Button>
                <Button type="button" variant="secondary" disabled={pending} onClick={() => act(item.id, "dismiss")}>
                  Dismiss
                </Button>
              </>
            ) : item.resolvedCallId ? (
              <a href={`/calls/${item.resolvedCallId}`} className="text-xs text-accent-hover hover:underline">
                Open call →
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RetentionForm({
  policy,
}: {
  policy: {
    redactPiiInTranscripts: boolean;
    retainCallDays: number;
  };
}) {
  const router = useRouter();
  const [state, setState] = useState(policy);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function save(runSweep = false) {
    setMsg(null);
    const res = await fetch("/api/settings/retention", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...state, runSweep }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error ?? "Save failed.");
      return;
    }
    setMsg(runSweep ? `Sweep done — calls ${data.result?.callsCleared ?? 0}.` : "Saved.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={state.redactPiiInTranscripts}
          onChange={(e) => setState((s) => ({ ...s, redactPiiInTranscripts: e.target.checked }))}
        />
        Redact emails/phones/SSNs in call transcripts
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-muted uppercase tracking-wider">Retain call transcripts (days, 0=forever)</span>
          <input
            type="number"
            min={0}
            value={state.retainCallDays}
            onChange={(e) => setState((s) => ({ ...s, retainCallDays: Number(e.target.value) }))}
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => save(false)} disabled={pending}>
          Save retention
        </Button>
        <Button type="button" variant="secondary" onClick={() => save(true)} disabled={pending}>
          Run sweep now
        </Button>
      </div>
      {msg && <p className="text-xs text-emerald-400">{msg}</p>}
    </div>
  );
}
