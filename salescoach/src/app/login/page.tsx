"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("sarah@meridian.demo");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Login failed.");
      return;
    }
    router.push(data.redirect || "/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[radial-gradient(ellipse_at_top,_#1a1f2b_0%,_#0b0e14_55%)]">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 space-y-4 shadow-2xl"
      >
        <div>
          <div className="text-xl font-semibold tracking-tight">
            <span className="text-accent-hover">Sales</span>Coach AI
          </div>
          <p className="text-sm text-muted mt-1">Sign in with your work email to open CRM + coaching.</p>
        </div>
        <label className="block text-xs text-muted uppercase tracking-wider">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
          required
        />
        <label className="block text-xs text-muted uppercase tracking-wider">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
          required
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full justify-center">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-[11px] text-muted">
          Demo accounts use password <code className="text-foreground/80">password123</code> (e.g.
          sarah@meridian.demo, alex@meridian.demo).
        </p>
      </form>
    </div>
  );
}
