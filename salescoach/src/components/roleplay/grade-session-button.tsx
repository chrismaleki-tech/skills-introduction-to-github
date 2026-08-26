"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

// Grades a COMPLETED session that never went through the in-chat end flow
// (e.g. a voice session, or a session ended by a manager).
export function GradeSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function grade() {
    setGrading(true);
    setError(null);
    try {
      const res = await fetch(`/api/roleplay/${sessionId}/end`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Grading failed. Try again.");
        setGrading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — try again.");
      setGrading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button onClick={() => void grade()} disabled={grading}>
        {grading ? "Grading..." : "Grade session"}
      </Button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </div>
  );
}
