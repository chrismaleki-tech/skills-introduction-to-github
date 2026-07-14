"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import type { IngestionPolicy } from "@/lib/types";
import { Field, InlineError, InlineSuccess, TextInput } from "./fields";

export function PolicyForm({ policy }: { policy: IngestionPolicy }) {
  const router = useRouter();
  const [minDuration, setMinDuration] = useState(String(policy.minDurationSec));
  const [threshold, setThreshold] = useState(String(policy.sampleThreshold));
  const [sampleSize, setSampleSize] = useState(String(policy.sampleSize));
  const [gradeManualUploads, setGradeManualUploads] = useState(policy.gradeManualUploads);
  const [autoMatchCrm, setAutoMatchCrm] = useState(policy.autoMatchCrm ?? true);
  const [gradeOutboundEmails, setGradeOutboundEmails] = useState(policy.gradeOutboundEmails ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function touch() {
    setSaved(false);
    setError("");
  }

  async function save() {
    const minDurationSec = parseInt(minDuration, 10);
    const sampleThreshold = parseInt(threshold, 10);
    const size = parseInt(sampleSize, 10);
    if (!Number.isInteger(minDurationSec) || minDurationSec < 0 || minDurationSec > 600) {
      setError("Minimum duration must be between 0 and 600 seconds.");
      return;
    }
    if (!Number.isInteger(sampleThreshold) || sampleThreshold < 1 || sampleThreshold > 100) {
      setError("Sampling threshold must be between 1 and 100.");
      return;
    }
    if (!Number.isInteger(size) || size < 1 || size > 100) {
      setError("Sample size must be between 1 and 100.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/settings/policy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minDurationSec,
        sampleThreshold,
        sampleSize: size,
        gradeManualUploads,
        autoMatchCrm,
        gradeOutboundEmails,
      }),
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
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Min call duration (sec)" hint="Shorter calls are skipped entirely.">
          <TextInput
            type="number"
            min={0}
            max={600}
            step={1}
            value={minDuration}
            onChange={(e) => {
              setMinDuration(e.target.value);
              touch();
            }}
          />
        </Field>
        <Field label="Sampling threshold" hint="Eligible calls per rep per month.">
          <TextInput
            type="number"
            min={1}
            max={100}
            step={1}
            value={threshold}
            onChange={(e) => {
              setThreshold(e.target.value);
              touch();
            }}
          />
        </Field>
        <Field label="Sample size" hint="Calls graded beyond the threshold.">
          <TextInput
            type="number"
            min={1}
            max={100}
            step={1}
            value={sampleSize}
            onChange={(e) => {
              setSampleSize(e.target.value);
              touch();
            }}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={gradeManualUploads}
          onChange={(e) => {
            setGradeManualUploads(e.target.checked);
            touch();
          }}
          className="accent-[var(--accent)] h-4 w-4"
        />
        Always grade manual uploads (bypass sampling)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={autoMatchCrm}
          onChange={(e) => {
            setAutoMatchCrm(e.target.checked);
            touch();
          }}
          className="accent-[var(--accent)] h-4 w-4"
        />
        Auto-match calls to CRM contacts/deals by prospect email, phone, or name
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={gradeOutboundEmails}
          onChange={(e) => {
            setGradeOutboundEmails(e.target.checked);
            touch();
          }}
          className="accent-[var(--accent)] h-4 w-4"
        />
        Grade outbound CRM emails against the active rubric
      </label>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save policy"}
        </Button>
        <InlineError message={error} />
        {saved && <InlineSuccess message="Policy saved." />}
      </div>
    </div>
  );
}
