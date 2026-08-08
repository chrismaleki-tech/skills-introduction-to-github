"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";

/** Clone a tenant's configuration into a sandbox workspace (no customer data). */
export function CreateSandboxButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    sandboxOrgId: string;
    name: string;
    adminEmail: string;
    temporaryPassword: string;
  } | null>(null);

  async function create() {
    if (!window.confirm("Create a sandbox clone of this tenant's configuration? No customer data is copied."))
      return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/orgs/${orgId}/sandbox`, { method: "POST" });
    const data = (await res.json().catch(() => null)) as
      | { error?: string; sandboxOrgId?: string; name?: string; adminEmail?: string; temporaryPassword?: string }
      | null;
    setBusy(false);
    if (!res.ok || !data?.sandboxOrgId) {
      setError(data?.error ?? "Sandbox creation failed.");
      return;
    }
    setResult({
      sandboxOrgId: data.sandboxOrgId,
      name: data.name ?? "",
      adminEmail: data.adminEmail ?? "",
      temporaryPassword: data.temporaryPassword ?? "",
    });
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" className="!px-3 !py-1.5 !text-xs" disabled={busy} onClick={() => void create()}>
        {busy ? "Cloning…" : "Create sandbox"}
      </Button>
      {result && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs space-y-1">
          <div>
            Created{" "}
            <Link href={`/admin/orgs/${result.sandboxOrgId}`} className="text-accent-hover hover:underline">
              {result.name}
            </Link>
          </div>
          <div className="text-muted">
            Sign-in (shown once): <span className="font-mono select-all">{result.adminEmail}</span>
            {" / "}
            <span className="font-mono select-all">{result.temporaryPassword}</span>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
