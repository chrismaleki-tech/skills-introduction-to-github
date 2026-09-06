"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

// Buttons used on the rubric library + detail pages: set-active and clone.

export function ActivateRubricButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function activate() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/rubrics/${id}/activate`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Could not set this rubric active.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <Button variant="secondary" onClick={activate} disabled={busy}>
        {busy ? "Setting active…" : "Set active"}
      </Button>
      {error && <p className="text-xs text-rose-700 mt-1.5">{error}</p>}
    </div>
  );
}

export function CloneRubricButton({
  id,
  label = "Clone to my team",
  variant = "primary",
}: {
  id: string;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function clone() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/rubrics/${id}/clone`, { method: "POST" });
    if (!res.ok) {
      setBusy(false);
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Could not clone this rubric.");
      return;
    }
    const data = (await res.json()) as { id: string };
    router.push(`/rubrics/${data.id}`);
    router.refresh();
  }

  return (
    <div>
      <Button variant={variant} onClick={clone} disabled={busy}>
        {busy ? "Cloning…" : label}
      </Button>
      {error && <p className="text-xs text-rose-700 mt-1.5">{error}</p>}
    </div>
  );
}
