"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

// Creates a text role-play session for a scenario and jumps into the chat.
export function StartSessionButton({
  scenarioId,
  variant = "primary",
}: {
  scenarioId: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/roleplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Could not start the session.");
        setStarting(false);
        return;
      }
      router.push(`/roleplay/${data.id}`);
    } catch {
      setError("Network error — try again.");
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button variant={variant} onClick={() => void start()} disabled={starting}>
        {starting ? "Starting..." : "Start session"}
      </Button>
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
