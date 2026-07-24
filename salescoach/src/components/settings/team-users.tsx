"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";

export function TeamUsersPanel({
  users,
}: {
  users: {
    id: string;
    name: string;
    email: string;
    role: string;
    title: string;
    lastLoginAt: Date | string | null;
  }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("REP");
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function invite() {
    setError(null);
    setOk(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role, title, password: password || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to create user.");
      return;
    }
    setOk(`Created ${data.email} (${data.role})${data.passwordSet ? " with password" : " — set a password later"}.`);
    setName("");
    setEmail("");
    setTitle("");
    setPassword("");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line text-sm">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="font-medium">{u.name}</span>
            <span className="text-muted">{u.email}</span>
            <span className="text-xs uppercase tracking-wider text-muted ml-auto">{u.role}</span>
          </li>
        ))}
      </ul>

      <div className="border-t border-line pt-4 space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted">Invite teammate</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
            placeholder="email@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="REP">Rep</option>
            <option value="MANAGER">Manager</option>
            <option value="TRAINER">Trainer</option>
            <option value="ADMIN">Admin</option>
          </select>
          <input
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type="password"
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm sm:col-span-2"
            placeholder="Temporary password (min 10 chars, optional)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="button" onClick={invite} disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </Button>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {ok && <p className="text-xs text-emerald-400">{ok}</p>}
      </div>
    </div>
  );
}
