"use client";

import { useRouter } from "next/navigation";

// Demo-auth user switcher: swaps the session cookie and refreshes. Lets you
// experience the platform as any role without a login flow.
export function UserSwitcher({
  users,
  currentId,
}: {
  users: { id: string; name: string; role: string; title: string }[];
  currentId: string;
}) {
  const router = useRouter();
  return (
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
  );
}
