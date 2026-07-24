"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { UserActions } from "@/components/admin/user-actions";
import { ImpersonateButton } from "@/components/admin/impersonation";

export type ConsoleOrgUser = {
  id: string;
  name: string;
  role: string;
  title: string;
  emailMasked: string;
  lastLogin: string | null;
  hasPassword: boolean;
  isStaff: boolean;
};

/**
 * Tenant users with PII masked by default. "Reveal emails" fetches the
 * unmasked values through an audited endpoint. Mutation controls render only
 * for the ADMIN console role; impersonation is available to SUPPORT as well.
 */
export function OrgUsersCard({
  orgId,
  users,
  canManage,
}: {
  orgId: string;
  users: ConsoleOrgUser[];
  canManage: boolean;
}) {
  const [revealed, setRevealed] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function reveal() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/orgs/${orgId}/pii`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Could not reveal emails.");
      return;
    }
    const data = (await res.json()) as { users: { id: string; email: string }[] };
    setRevealed(Object.fromEntries(data.users.map((u) => [u.id, u.email])));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted">PII is masked by default.</span>
        {revealed ? (
          <Button variant="secondary" className="!px-2.5 !py-1 !text-xs" onClick={() => setRevealed(null)}>
            Mask again
          </Button>
        ) : (
          <Button variant="secondary" className="!px-2.5 !py-1 !text-xs" onClick={reveal} disabled={busy}>
            {busy ? "Revealing…" : "Reveal emails (audited)"}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-rose-400 mb-2">{error}</p>}
      <div className="space-y-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="font-medium text-sm">
                {user.name}
                <span className="text-muted font-normal"> · {user.title || user.role.toLowerCase()}</span>
              </div>
              <div className="text-xs text-muted truncate">
                {revealed?.[user.id] ?? user.emailMasked}
                {" · "}
                {user.lastLogin ? `last login ${user.lastLogin}` : "never logged in"}
                {!user.hasPassword && <span className="text-amber-400"> · no password set — cannot log in</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!user.isStaff && <ImpersonateButton userId={user.id} />}
              {canManage && <UserActions userId={user.id} role={user.role} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
