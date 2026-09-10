"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function CompleteButton({ id, done, target }: { id: string; done: number; target: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function complete() {
    if (done < target && !window.confirm(`Progress is ${done} of ${target}. Mark this assignment complete anyway?`)) {
      return;
    }
    setBusy(true);
    setError(false);
    const res = await fetch(`/api/assignments/${id}/complete`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="secondary" onClick={complete} disabled={busy}>
        {busy ? "Saving…" : "Mark complete"}
      </Button>
      {error && <span className="text-xs text-rose-700">Failed — try again</span>}
    </span>
  );
}
