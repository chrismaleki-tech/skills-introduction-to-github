"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";

export function PoActions({
  poId,
  status,
  lines,
}: {
  poId: string;
  status: string;
  lines?: Array<{ productId: string | null; description: string; quantity: number; qtyReceived: number }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function run(action: string, extra?: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/erp/purchasing/${poId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed.");
      return;
    }
    startTransition(() => router.refresh());
  }

  const remaining =
    lines
      ?.map((l) => ({
        productId: l.productId,
        description: l.description,
        quantity: Math.max(0, l.quantity - l.qtyReceived),
      }))
      .filter((l) => l.quantity > 0) ?? [];

  const canReceive = ["approved", "submitted", "partial", "pending_approval"].includes(status);

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && (
        <Button disabled={pending} variant="secondary" onClick={() => run("submit")}>
          Submit for approval
        </Button>
      )}
      {(status === "pending_approval" || status === "submitted" || status === "draft") && (
        <Button disabled={pending} variant="secondary" onClick={() => run("approve")}>
          Approve
        </Button>
      )}
      {canReceive && remaining.length > 0 && (
        <>
          <Button
            disabled={pending}
            variant="secondary"
            onClick={() =>
              run("receive_partial", {
                lines: remaining.map((l) => ({
                  ...l,
                  quantity: Math.max(1, Math.floor(l.quantity / 2) || 1),
                })),
              })
            }
          >
            Receive partial
          </Button>
          <Button disabled={pending} onClick={() => run("receive")}>
            Receive all
          </Button>
        </>
      )}
      {error && <p className="text-xs text-rose-400 w-full">{error}</p>}
    </div>
  );
}
