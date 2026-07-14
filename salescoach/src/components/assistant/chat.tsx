"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  DomainTabs,
  MessageActions,
  ReplyBody,
  ReplyLinks,
  ResultCard,
  SourceBadges,
} from "./reply";
import { streamAssistantChat, useAskSession } from "./use-ask-session";

const SUGGESTIONS = [
  "What's our pipeline look like?",
  "Show me the Cascade deal",
  "List open quotes",
  "Who needs coaching?",
  "What was Alex's last Cascade call score?",
];

export function AssistantChat() {
  const pathname = usePathname();
  const hideOnAsk = pathname === "/ask" || pathname.startsWith("/ask/");
  const { domain, setDomain, messages, setMessages, uid } = useAskSession();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [open, messages, pending]);

  if (hideOnAsk) return null;

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setInput("");
    const userMsg = { id: uid(), role: "user" as const, content: message };
    const assistantId = uid();
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "", pending: true },
    ]);
    setPending(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const result = await streamAssistantChat({
        message,
        history,
        domain,
        signal: ac.signal,
        onToken: (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk, pending: true } : m,
            ),
          );
        },
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: result.reply || m.content,
                links: result.links,
                sources: result.sources,
                mode: result.mode,
                data: result.data,
                followUps: result.followUps,
                pending: false,
              }
            : m,
        ),
      );
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: e instanceof Error ? e.message : "Something went wrong.",
                pending: false,
              }
            : m,
        ),
      );
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

  const showWelcome = messages.length === 0;

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
              <div className="text-[11px] text-muted mt-0.5">CRM · ERP · sales trainer · synced with Ask</div>
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

          <div className="px-3 pt-2 border-b border-line">
            <DomainTabs value={domain} onChange={setDomain} compact />
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {showWelcome && (
              <div className="rounded-2xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed">
                Ask in plain language across CRM, ERP, and the sales trainer. History stays in sync with
                the full Ask page.
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-accent text-white rounded-br-md"
                      : "bg-surface-2 border border-line text-foreground rounded-bl-md"
                  }`}
                >
                  <ReplyBody content={m.content || (m.pending ? "…" : "")} invert={m.role === "user"} />
                  {!m.pending && m.role === "assistant" && (
                    <>
                      <ResultCard data={m.data} />
                      <SourceBadges sources={m.sources} />
                      <ReplyLinks links={m.links} onNavigate={() => setOpen(false)} />
                      <MessageActions content={m.content} />
                      {m.mode === "demo" && (
                        <div className="mt-1.5 text-[10px] text-muted/80">Demo router · live seeded data</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {pending && <div className="text-xs text-muted px-1">Streaming…</div>}
            <div ref={bottomRef} />
          </div>

          {showWelcome && (
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
              placeholder="Ask about Cascade, quotes, call scores…"
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
