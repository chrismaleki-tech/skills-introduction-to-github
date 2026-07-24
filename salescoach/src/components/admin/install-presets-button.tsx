"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function InstallPresetsButton({ missingCount }: { missingCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function install() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/presets", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Install failed.");
      return;
    }
    router.refresh();
  }

  if (!missingCount) return null;
  return (
    <div>
      <Button onClick={install} disabled={busy}>
        {busy ? "Installing…" : `Install ${missingCount} missing preset${missingCount > 1 ? "s" : ""}`}
      </Button>
      {error && <p className="text-xs text-rose-400 mt-1.5">{error}</p>}
    </div>
  );
}
