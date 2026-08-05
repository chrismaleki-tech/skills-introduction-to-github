"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

type Field = { key: string; label: string; type: "text" | "number" | "date" | "select"; options?: string[] };
type Values = Record<string, string | number>;

/**
 * Industry/custom properties editor ("Custom Data Architecture"): renders the
 * org's configured field definitions with typed inputs and PATCHes values as
 * { custom: {...} } to the given endpoint.
 */
export function CustomFieldsCard({
  endpoint,
  fields,
  values,
}: {
  endpoint: string;
  fields: Field[];
  values: Values;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, values[f.key] != null ? String(values[f.key]) : ""])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  if (!fields.length) return null;

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom: draft }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Could not save.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const inputClass = "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="block">
            <span className="text-xs uppercase tracking-wider text-muted">{field.label}</span>
            {field.type === "select" ? (
              <select
                className={`mt-1 ${inputClass}`}
                value={draft[field.key] ?? ""}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
              >
                <option value="">—</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                className={`mt-1 ${inputClass}`}
                value={draft[field.key] ?? ""}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
              />
            )}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="secondary" className="!px-3 !py-1.5 !text-xs" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save details"}
        </Button>
        {saved && <span className="text-xs text-emerald-400">Saved.</span>}
        {error && <span className="text-xs text-rose-400">{error}</span>}
      </div>
    </div>
  );
}
