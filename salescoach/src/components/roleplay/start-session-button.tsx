"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

// Starts a role-play against a scenario and jumps into it. Voice (a live
// spoken call with the AI prospect) is the primary action; text is offered
// as a smaller secondary option. When the server has no voice configured,
// only the text option is rendered.
export function StartSessionButton({
  scenarioId,
  variant = "primary",
  voiceEnabled = true,
  compact = false,
}: {
  scenarioId: string;
  variant?: "primary" | "secondary";
  voiceEnabled?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState<"VOICE" | "TEXT" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(mode: "VOICE" | "TEXT") {
    if (starting) return;
    setStarting(mode);
    setError(null);
    try {
      const res = await fetch("/api/roleplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, mode }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Could not start the session.");
        setStarting(null);
        return;
      }
      router.push(`/roleplay/${data.id}`);
    } catch {
      setError("Network error — try again.");
      setStarting(null);
    }
  }

  if (!voiceEnabled) {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <Button variant={variant} onClick={() => void start("TEXT")} disabled={starting !== null}>
          {starting ? "Starting..." : "Start text role-play"}
        </Button>
        {error && <span className="text-xs text-rose-700">{error}</span>}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 ${compact ? "items-end" : "items-start"}`}>
      <Button variant={variant} onClick={() => void start("VOICE")} disabled={starting !== null}>
        <MicIcon />
        {starting === "VOICE" ? "Starting..." : "Start role-play"}
      </Button>
      <button
        type="button"
        onClick={() => void start("TEXT")}
        disabled={starting !== null}
        className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
      >
        {starting === "TEXT" ? "Starting..." : "Prefer to type? Start a text role-play"}
      </button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </div>
  );
}

function MicIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}
