"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

// Copies the scenario and opens the copy's editor so it can be tweaked.
export function DuplicateScenarioButton({ scenarioId }: { scenarioId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function duplicate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/roleplay/scenarios/${scenarioId}/duplicate`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Could not duplicate.");
        setBusy(false);
        return;
      }
      router.push(`/scenarios/${data.id}/edit`);
    } catch {
      setError("Network error — try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="secondary" onClick={() => void duplicate()} disabled={busy}>
        {busy ? "Copying..." : "Duplicate"}
      </Button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </div>
  );
}
