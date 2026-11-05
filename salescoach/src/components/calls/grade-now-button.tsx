"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

// Triggers on-demand grading (or a retry after a failure) and refreshes the
// server-rendered review page once the pipeline finishes.

export function GradeNowButton({
  callId,
  label,
  variant = "primary",
}: {
  callId: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function gradeNow() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${callId}/grade`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Grading failed. Try again.");
      }
      router.refresh();
    } catch {
      setError("Grading failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant={variant} onClick={gradeNow} disabled={pending}>
        {pending ? "Grading…" : label}
      </Button>
      {error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}
