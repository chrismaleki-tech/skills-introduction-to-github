"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

// Manager-only. The API refuses to delete scenarios with sessions against
// them; this button is only rendered when the scenario is unused.
export function DeleteScenarioButton({ scenarioId }: { scenarioId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Delete this scenario? This cannot be undone.")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/roleplay/scenarios/${scenarioId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not delete the scenario.");
        setDeleting(false);
        return;
      }
      router.push("/scenarios");
      router.refresh();
    } catch {
      setError("Network error — try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button variant="danger" onClick={() => void remove()} disabled={deleting}>
        {deleting ? "Deleting..." : "Delete scenario"}
      </Button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </div>
  );
}
