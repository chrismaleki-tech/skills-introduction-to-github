"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const ROLES = ["REP", "MANAGER", "TRAINER", "ADMIN"];

/** Per-user maintenance row actions: change role, reset password. */
export function UserActions({ userId, role }: { userId: string; role: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [password, setPassword] = useState("");

  async function patch(body: { password?: string; role?: string }, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Update failed.");
      return;
    }
    setNotice(success);
    setShowReset(false);
    setPassword("");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <select
          value={role}
          disabled={busy}
          onChange={(e) => void patch({ role: e.target.value }, "Role updated.")}
          className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <Button variant="secondary" className="!px-2.5 !py-1 !text-xs" onClick={() => setShowReset((v) => !v)}>
          Reset password
        </Button>
      </div>
      {showReset && (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={10}
            placeholder="New password (min 10)"
            className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs w-44"
          />
          <Button
            className="!px-2.5 !py-1 !text-xs"
            disabled={busy || password.trim().length < 10}
            onClick={() => void patch({ password }, "Password reset.")}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
      {notice && <p className="text-[11px] text-emerald-400">{notice}</p>}
    </div>
  );
}
