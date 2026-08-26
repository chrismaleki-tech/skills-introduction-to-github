"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function StartSessionButton({
  scenarioId,
  variant = "primary",
}: {
  scenarioId: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [starting, setStarting] = useState<"TEXT" | "VOICE" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(mode: "TEXT" | "VOICE") {
    setStarting(mode);
    setError(null);
    try {
      const res = await fetch("/api/roleplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, mode }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
        demoCompleted?: boolean;
        vapiJoinUrl?: string | null;
      };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Could not start the session.");
        setStarting(null);
        return;
      }
      if (data.vapiJoinUrl) {
        window.open(data.vapiJoinUrl, "_blank", "noopener,noreferrer");
        router.push(`/roleplay/${data.id}?voice=1`);
      } else {
        router.push(`/roleplay/${data.id}`);
      }
      router.refresh();
    } catch {
      setError("Network error — try again.");
      setStarting(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-2">
        <Button variant={variant} onClick={() => void start("TEXT")} disabled={!!starting}>
          {starting === "TEXT" ? "Starting..." : "Start text session"}
        </Button>
        <Button variant="secondary" onClick={() => void start("VOICE")} disabled={!!starting}>
          {starting === "VOICE" ? "Starting..." : "Start voice session"}
        </Button>
      </div>
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
