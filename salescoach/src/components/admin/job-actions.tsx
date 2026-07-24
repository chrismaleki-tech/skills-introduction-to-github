"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function RetryJobButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function retry() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry", id }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Retry failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="text-right">
      <Button variant="secondary" className="!px-2.5 !py-1 !text-xs" onClick={retry} disabled={busy}>
        {busy ? "Retrying…" : "Retry"}
      </Button>
      {error && <p className="text-[11px] text-rose-400 mt-1">{error}</p>}
    </div>
  );
}

export function RunPendingButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function run() {
    setBusy(true);
    setNotice("");
    const res = await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run-pending" }),
    });
    setBusy(false);
    const data = (await res.json().catch(() => null)) as { ran?: number; error?: string } | null;
    setNotice(res.ok ? `Ran ${data?.ran ?? 0} pending job(s).` : (data?.error ?? "Failed."));
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {notice && <span className="text-xs text-muted">{notice}</span>}
      <Button variant="secondary" onClick={run} disabled={busy}>
        {busy ? "Running…" : "Run pending now"}
      </Button>
    </div>
  );
}
