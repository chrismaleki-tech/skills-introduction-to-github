"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const inputCls = "w-full bg-surface-2 border border-line rounded-lg px-2.5 py-2 text-sm";
const labelCls = "block text-xs text-muted uppercase tracking-wider mb-1.5";

export function NewAssignmentForm({
  reps,
  scenarios,
  defaultRepId,
}: {
  reps: { id: string; name: string; title: string }[];
  scenarios: { id: string; title: string }[];
  defaultRepId?: string;
}) {
  const router = useRouter();
  const [repId, setRepId] = useState(defaultRepId ?? reps[0]?.id ?? "");
  const [type, setType] = useState<"ROLEPLAY" | "UPLOAD_CALLS">("ROLEPLAY");
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? "");
  const [targetCount, setTargetCount] = useState(1);
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!repId) {
      setError("Pick a rep to assign to.");
      return;
    }
    if (type === "ROLEPLAY" && !scenarioId) {
      setError("Role-play assignments need a scenario.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignedToId: repId,
        type,
        scenarioId: type === "ROLEPLAY" ? scenarioId : null,
        targetCount,
        dueDate: dueDate || null,
        note,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not create the assignment.");
      return;
    }
    setNote("");
    setDueDate("");
    setTargetCount(1);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className={labelCls} htmlFor="na-rep">
          Rep
        </label>
        <select id="na-rep" className={inputCls} value={repId} onChange={(e) => setRepId(e.target.value)}>
          {reps.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.title ? ` — ${r.title}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="na-type">
          Type
        </label>
        <select
          id="na-type"
          className={inputCls}
          value={type}
          onChange={(e) => setType(e.target.value as "ROLEPLAY" | "UPLOAD_CALLS")}
        >
          <option value="ROLEPLAY">Role-play practice</option>
          <option value="UPLOAD_CALLS">Upload calls</option>
        </select>
      </div>
      {type === "ROLEPLAY" && (
        <div>
          <label className={labelCls} htmlFor="na-scenario">
            Scenario
          </label>
          <select id="na-scenario" className={inputCls} value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
            {scenarios.length === 0 && <option value="">No scenarios available</option>}
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className={labelCls} htmlFor="na-target">
          Target count
        </label>
        <input
          id="na-target"
          type="number"
          min={1}
          max={50}
          className={inputCls}
          value={targetCount}
          onChange={(e) => setTargetCount(Math.max(1, Number(e.target.value) || 1))}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="na-due">
          Due date
        </label>
        <input id="na-due" type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <label className={labelCls} htmlFor="na-note">
          Note
        </label>
        <textarea
          id="na-note"
          rows={2}
          className={inputCls}
          placeholder="Why this practice matters, e.g. the skill dip you saw"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create assignment"}
        </Button>
        {error && <span className="text-sm text-rose-700">{error}</span>}
      </div>
    </form>
  );
}
