"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Field, InlineError, InlineSuccess, TextInput } from "./fields";

export function OrgNameForm({ name }: { name: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Team name cannot be empty.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/settings/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Save failed. Please try again.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Field label="Team name" hint="Shown in the sidebar and on reports.">
        <TextInput
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
            setError("");
          }}
          maxLength={120}
        />
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save name"}
        </Button>
        <InlineError message={error} />
        {saved && <InlineSuccess message="Name saved." />}
      </div>
    </div>
  );
}
