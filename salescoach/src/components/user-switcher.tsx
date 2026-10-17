"use client";

import { useRouter } from "next/navigation";
import { demoSwitcherHint } from "./demo-hint";

// Demo-auth user switcher + logout. Switcher posts only when ALLOW_DEMO_SWITCHER
// is enabled (default outside production).
export function UserSwitcher({
  users,
  currentId,
  allowSwitcher = true,
}: {
  users: { id: string; name: string; role: string; title: string }[];
  currentId: string;
  allowSwitcher?: boolean;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {allowSwitcher ? (
        <select
          className="w-full bg-surface-2 border border-line rounded-lg px-2.5 py-2 text-sm"
          value={currentId}
          onChange={async (e) => {
            await fetch("/api/session/switch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: e.target.value }),
            });
            router.push("/");
            router.refresh();
          }}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} — {u.title || u.role}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-[11px] text-muted px-1">{demoSwitcherHint()}</p>
      )}
      <button
        type="button"
        onClick={() => void logout()}
        className="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-muted hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
