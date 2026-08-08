"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

type DemoWorkspace = {
  org: string;
  manager: { name: string; email: string; title: string };
  rep: { name: string; email: string; title: string } | null;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("sarah@meridian.demo");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [workspaces, setWorkspaces] = useState<DemoWorkspace[]>([]);

  useEffect(() => {
    fetch("/api/auth/demo-directory")
      .then((res) => (res.ok ? res.json() : { workspaces: [] }))
      .then((data: { workspaces?: DemoWorkspace[] }) => setWorkspaces(data.workspaces ?? []))
      .catch(() => {});
  }, []);

  async function login(asEmail: string, asPassword: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: asEmail, password: asPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        return;
      }
      router.push(data.redirect || "/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server — try again.");
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await login(email, password);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-10 bg-[radial-gradient(ellipse_at_top,_#1a1f2b_0%,_#0b0e14_55%)]">
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

      {workspaces.length > 0 && (
        <div className="w-full max-w-3xl">
          <p className="text-center text-xs text-muted uppercase tracking-wider mb-3">
            Or explore a demo workspace
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {workspaces.map((ws) => (
              <div key={ws.org} className="rounded-xl border border-line bg-surface p-4 shadow-xl">
                <div className="font-semibold text-sm mb-2">{ws.org}</div>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void login(ws.manager.email, "password123")}
                    className="w-full text-left rounded-lg border border-line bg-surface-2 hover:bg-line transition-colors px-2.5 py-1.5 text-xs disabled:opacity-50"
                  >
                    <span className="font-medium">{ws.manager.name}</span>
                    <span className="text-muted"> · {ws.manager.title || "Manager"}</span>
                  </button>
                  {ws.rep && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void login(ws.rep!.email, "password123")}
                      className="w-full text-left rounded-lg border border-line bg-surface-2 hover:bg-line transition-colors px-2.5 py-1.5 text-xs disabled:opacity-50"
                    >
                      <span className="font-medium">{ws.rep.name}</span>
                      <span className="text-muted"> · {ws.rep.title || "Rep"}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
