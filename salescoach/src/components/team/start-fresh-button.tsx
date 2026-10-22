"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StartFreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/account/start-fresh", { method: "POST" });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setBusy(false);
      setError(data?.error ?? "Could not create a workspace.");
      return;
    }
    router.replace("/getting-started");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Setting up…" : "Start my own workspace"}
      </button>
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}
