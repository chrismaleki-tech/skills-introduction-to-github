"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const ROLES = ["REP", "MANAGER", "TRAINER", "ADMIN"];

type PatchBody = { role?: string; resetPassword?: boolean; disabled?: boolean };

/**
 * Row actions for a team seat: change role, reset password (one-time temp
 * password reveal), deactivate / reactivate. Guards live in the API; this
 * mirrors them with confirms and inline errors.
 */
export function MemberActions({
  userId,
  role,
  disabled,
  isSelf,
  canManageAdmins,
}: {
  userId: string;
  role: string;
  disabled: boolean;
  isSelf: boolean;
  canManageAdmins: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [oneTime, setOneTime] = useState("");

  async function patch(body: PatchBody) {
    setBusy(true);
    setError("");
    setOneTime("");
    const res = await fetch(`/api/backoffice/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as
      | { error?: string; oneTimePassword?: string | null }
      | null;
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Update failed.");
      return;
    }
    if (data?.oneTimePassword) setOneTime(data.oneTimePassword);
    router.refresh();
  }

  const adminLocked = role === "ADMIN" && !canManageAdmins;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <select
          value={role}
          disabled={busy || isSelf || adminLocked || disabled}
          title={isSelf ? "You cannot change your own role" : undefined}
          onChange={(e) => {
            const next = e.target.value;
            if (!window.confirm(`Change this seat's role from ${role} to ${next}?`)) {
              e.target.value = role;
              return;
            }
            void patch({ role: next });
          }}
          className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs disabled:opacity-50"
        >
          {ROLES.map((r) => (
            <option key={r} value={r} disabled={r === "ADMIN" && !canManageAdmins}>
              {r}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          className="!px-2.5 !py-1 !text-xs"
          disabled={busy || adminLocked || disabled}
          onClick={() => {
            if (window.confirm("Reset this seat's password? A one-time temporary password will be shown once."))
              void patch({ resetPassword: true });
          }}
        >
          Reset password
        </Button>
        {disabled ? (
          <Button
            variant="secondary"
            className="!px-2.5 !py-1 !text-xs"
            disabled={busy || adminLocked}
            onClick={() => void patch({ disabled: false })}
          >
            Reactivate
          </Button>
        ) : (
          <Button
            variant="danger"
            className="!px-2.5 !py-1 !text-xs"
            disabled={busy || isSelf || adminLocked}
            title={isSelf ? "You cannot deactivate your own seat" : undefined}
            onClick={() => {
              if (window.confirm("Deactivate this seat? The user is signed out immediately and cannot log in."))
                void patch({ disabled: true });
            }}
          >
            Deactivate
          </Button>
        )}
      </div>
      {oneTime && (
        <p className="text-[11px] text-amber-300">
          One-time password (shown once): <span className="font-mono select-all">{oneTime}</span>
        </p>
      )}
      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  );
}
