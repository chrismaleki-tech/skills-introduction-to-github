"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

// Manager calibration form: override the AI score (0-100) and/or leave a
// comment. Clearing the score field removes the override.

export function OverrideForm({
  callId,
  initialScore,
  initialComment,
}: {
  callId: string;
  initialScore: number | null;
  initialComment: string | null;
}) {
  const router = useRouter();
  const [score, setScore] = useState(initialScore != null ? String(initialScore) : "");
  const [comment, setComment] = useState(initialComment ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/calls/${callId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: score.trim() === "" ? null : Number(score),
          comment,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not save the override.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not save the override.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="override-score" className="block text-xs text-muted mb-1">
          Override score (0-100, leave blank to keep the AI score)
        </label>
        <input
          id="override-score"
          type="number"
          min={0}
          max={100}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="w-32 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm tabular-nums outline-none focus:border-accent"
        />
      </div>
      <div>
        <label htmlFor="override-comment" className="block text-xs text-muted mb-1">
          Coaching note (visible to the rep)
        </label>
        <textarea
          id="override-comment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Why the score was adjusted, or what to focus on next."
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent resize-y"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save override"}
        </Button>
        {saved && <span className="text-xs text-emerald-700">Saved.</span>}
        {error && <span className="text-xs text-rose-700">{error}</span>}
      </div>
    </form>
  );
}
