"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import type { RoleplayMessage } from "@/lib/types";

// Live text role-play. The rep types; the AI prospect replies through
// POST /api/roleplay/[id]/message. Rep messages render optimistically.

export function RoleplayChat({
  sessionId,
  initialMessages,
  personaName,
  repName,
  startedAtIso,
}: {
  sessionId: string;
  initialMessages: RoleplayMessage[];
  personaName: string;
  repName: string;
  startedAtIso: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<RoleplayMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Initialized to 0 (not Date.now()) so server render and client hydration agree.
  const [elapsedSec, setElapsedSec] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedAtMs = new Date(startedAtIso).getTime();

  useEffect(() => {
    const tick = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAtMs]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const repTurns = messages.filter((m) => m.role === "rep").length;

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || ending) return;
    setError(null);
    setInput("");
    setSending(true);
    // Optimistic rep bubble; the server records its own timestamp.
    setMessages((prev) => [...prev, { role: "rep", text, atMs: Date.now() - startedAtMs }]);
    try {
      const res = await fetch(`/api/roleplay/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        setError(data.error ?? "The prospect did not reply. Try sending another message.");
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: "prospect", text: data.reply!, atMs: Date.now() - startedAtMs },
      ]);
    } catch {
      setError("Network error — your last message may not have been saved.");
    } finally {
      setSending(false);
    }
  }, [input, sending, ending, sessionId, startedAtMs]);

  const endSession = useCallback(async () => {
    if (sending || ending) return;
    setError(null);
    setEnding(true);
    try {
      const res = await fetch(`/api/roleplay/${sessionId}/end`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not grade the session. Try again.");
        return;
      }
      // The server component re-renders this route as the graded view.
      router.push(`/roleplay/${sessionId}`);
      router.refresh();
      return; // keep the button disabled while the graded view loads
    } catch {
      setError("Network error while ending the session. Try again.");
    }
    setEnding(false);
  }, [sending, ending, sessionId, router]);

  return (
    <div className="bg-surface border border-line rounded-xl flex flex-col">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line">
        <div className="text-sm font-medium">
          Live session with <span className="text-brand">{personaName || "the prospect"}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted tabular-nums">
          <span>{fmtClock(elapsedSec)} elapsed</span>
          <span>
            {repTurns} {repTurns === 1 ? "turn" : "turns"}
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3 min-h-72 max-h-[28rem]">
        {messages.length === 0 && !sending && (
          <p className="text-sm text-muted text-center py-10">
            No messages yet. Deliver your opener to start the conversation.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "rep" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "rep"
                  ? "bg-brand/10 border border-brand/25"
                  : "bg-surface-2 border border-line"
              }`}
            >
              <div className={`text-xs font-medium mb-0.5 ${m.role === "rep" ? "text-brand" : "text-muted"}`}>
                {m.role === "rep" ? repName : personaName || "Prospect"}
              </div>
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3.5 py-2.5 text-sm bg-surface-2 border border-line text-muted italic">
              {personaName || "Prospect"} is typing...
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-5 mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="border-t border-line p-4 space-y-3">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Say something to the prospect... (Enter to send, Shift+Enter for a new line)"
            rows={2}
            maxLength={2000}
            disabled={sending || ending}
            className="flex-1 resize-none rounded-lg bg-surface-2 border border-line px-3 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:border-accent disabled:opacity-50"
          />
          <Button onClick={() => void send()} disabled={sending || ending || !input.trim()}>
            Send
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {repTurns < 2
              ? "Grading unlocks after two of your turns."
              : "End whenever the conversation reaches a natural close."}
          </p>
          <Button variant="secondary" onClick={() => void endSession()} disabled={sending || ending || repTurns < 2}>
            {ending ? "Grading..." : "End session & get graded"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
