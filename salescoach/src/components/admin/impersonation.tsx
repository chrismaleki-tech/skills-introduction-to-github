"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

/** Persistent banner shown while a staff "view as customer" session is active. */
export function ImpersonationBanner({
  orgName,
  targetName,
  adminName,
  expiresAtMs,
}: {
  orgName: string;
  targetName: string;
  adminName: string;
  expiresAtMs: number | null;
}) {
  const [busy, setBusy] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    const update = () =>
      setMinutesLeft(expiresAtMs ? Math.max(0, Math.round((expiresAtMs - Date.now()) / 60000)) : 0);
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [expiresAtMs]);

  async function exit() {
    setBusy(true);
    await fetch("/api/admin/impersonate/exit", { method: "POST" });
    window.location.href = "/admin";
  }

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-400/40 bg-amber-400/15 px-4 py-2 text-xs text-amber-200 backdrop-blur">
      <span>
        <span className="font-semibold">Viewing as {orgName}</span> ({targetName}) · read-only · {adminName}
        {minutesLeft != null && ` · ${minutesLeft}m left`} · this access is logged and visible to the customer
      </span>
      <Button variant="secondary" className="!px-2.5 !py-0.5 !text-xs" onClick={exit} disabled={busy}>
        {busy ? "Exiting…" : "Exit"}
      </Button>
    </div>
  );
}

/** "View as" button on the console's org-detail user rows. */
export function ImpersonateButton({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      setBusy(false);
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Could not start impersonation.");
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="text-right">
      <Button variant="secondary" className="!px-2.5 !py-1 !text-xs" onClick={start} disabled={busy}>
        {busy ? "Starting…" : "View as"}
      </Button>
      {error && <p className="text-[11px] text-rose-400 mt-1">{error}</p>}
    </div>
  );
}
