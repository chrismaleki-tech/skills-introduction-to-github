"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinTeamButton({ token, orgName }: { token: string; orgName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/join/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setBusy(false);
      setError(data?.error ?? "Could not join this team.");
      return;
    }
    router.replace("/getting-started?joined=1");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={join}
        disabled={busy}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Joining…" : `Join ${orgName}`}
      </button>
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}
