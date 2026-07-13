"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type LinkItem = { href: string; label: string };
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  links?: LinkItem[];
  mode?: "demo" | "llm";
};

const SUGGESTIONS = [
  "What's our pipeline look like?",
  "Show me the Cascade deal",
  "List open quotes",
  "Finance snapshot",
  "Who needs coaching?",
  "What's low in inventory?",
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Ask me in plain language across coaching, CRM, and ERP — pipeline, quotes, orders, invoices, inventory, or who needs coaching.",
      links: [
        { href: "/crm", label: "Pipeline" },
        { href: "/erp", label: "ERP" },
        { href: "/dashboard", label: "Dashboard" },
      ],
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [open, messages, pending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setInput("");
    const userMsg: Msg = { id: uid(), role: "user", content: message };
    setMessages((prev) => [...prev, userMsg]);
    setPending(true);
    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: data.error ?? "Something went wrong." },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: data.reply ?? "Done.",
          links: data.links,
          mode: data.mode,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: "Network error talking to the assistant." },
      ]);
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-medium text-white shadow-lg shadow-black/30 hover:bg-accent-hover transition-colors"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
          Ask SalesCoach
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-40 flex h-[min(640px,calc(100vh-2.5rem))] w-[min(420px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/50">
          <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 bg-surface-2/60">
            <div>
              <div className="text-sm font-semibold tracking-tight">Platform assistant</div>
              <div className="text-[11px] text-muted mt-0.5">
                Natural language across CRM · ERP · coaching
              </div>
              <Link
                href="/ask"
                onClick={() => setOpen(false)}
                className="mt-1.5 inline-block text-[11px] text-accent-hover hover:underline"
              >
                Open full Ask view →
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-line hover:text-foreground"
              aria-label="Close assistant"
            >
              Close
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-accent text-white rounded-br-md"
                      : "bg-surface-2 border border-line text-foreground rounded-bl-md"
                  }`}
                >
                  {m.content}
                  {m.links && m.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.links.map((l) => (
                        <Link
                          key={l.href + l.label}
                          href={l.href}
                          className="inline-flex rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] text-accent-hover hover:bg-accent/20"
                          onClick={() => setOpen(false)}
                        >
                          {l.label} →
                        </Link>
                      ))}
                    </div>
                  )}
                  {m.mode === "demo" && m.role === "assistant" && m.id !== "welcome" && (
                    <div className="mt-1.5 text-[10px] text-muted/80">Demo router · no API key</div>
                  )}
                </div>
              </div>
            ))}
            {pending && (
              <div className="text-xs text-muted px-1">Working across modules…</div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 2 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => void send(s)}
                  className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] text-muted hover:text-foreground hover:border-accent/40 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="border-t border-line p-3 flex gap-2 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder="Ask about Cascade, quotes, who needs coaching…"
              className="flex-1 resize-none rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent/50"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 px-3.5 py-2 text-sm font-medium text-white"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
