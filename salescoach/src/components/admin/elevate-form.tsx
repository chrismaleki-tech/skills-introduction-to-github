"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";

export function ElevateForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password") as string;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/elevate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Could not verify your password.");
      return;
    }
    const next = params.get("next") || "/admin";
    router.push(next.startsWith("/") ? next : "/admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        name="password"
        type="password"
        required
        autoFocus
        placeholder="Your password"
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
      />
      <Button type="submit" disabled={busy} className="w-full justify-center">
        {busy ? "Verifying…" : "Unlock console"}
      </Button>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </form>
  );
}
