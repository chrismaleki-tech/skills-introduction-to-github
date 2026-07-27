"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/** Invite a teammate into the org (posts to the existing seat-create API). */
export function InviteForm({ canCreateAdmin }: { canCreateAdmin: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("REP");
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function invite() {
    setError("");
    setOk("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role, title, password: password || undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      email?: string;
      role?: string;
      passwordSet?: boolean;
    };
    if (!res.ok) {
      setError(data.error ?? "Failed to create user.");
      return;
    }
    setOk(`Created ${data.email} (${data.role})${data.passwordSet ? "." : " — reset a password from the seat row."}`);
    setName("");
    setEmail("");
    setTitle("");
    setPassword("");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-2">
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
          {canCreateAdmin && <option value="ADMIN">Admin</option>}
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
      <Button type="button" onClick={() => void invite()} disabled={pending || !name || !email}>
        {pending ? "Creating…" : "Create seat"}
      </Button>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {ok && <p className="text-xs text-emerald-400">{ok}</p>}
    </div>
  );
}
