"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  DomainTabs,
  ReplyBody,
  ReplyLinks,
  SourceBadges,
  SOURCE_LABEL,
  type AssistantDomain,
  type AssistantLinkItem,
  type AssistantSource,
} from "./reply";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  links?: AssistantLinkItem[];
  sources?: AssistantSource[];
  mode?: "demo" | "llm";
};

const EXAMPLES: Record<AssistantDomain, { label: string; query: string }[]> = {
  all: [
    { label: "Pipeline health", query: "What's our pipeline look like?" },
    { label: "Cascade deal", query: "Show me the Cascade deal" },
    { label: "Open quotes", query: "List open quotes" },
    { label: "Finance", query: "Finance snapshot" },
    { label: "Coaching queue", query: "Who needs coaching?" },
    { label: "Call score", query: "What was Alex's last Cascade call score?" },
  ],
  crm: [
    { label: "Pipeline", query: "What's our pipeline look like?" },
    { label: "Cascade", query: "Show me the Cascade deal" },
    { label: "BlueRidge", query: "Status of the BlueRidge deal" },
    { label: "Find Dana", query: "Find contact Dana" },
  ],
  erp: [
    { label: "Finance", query: "Finance snapshot" },
    { label: "Quotes", query: "List open quotes" },
    { label: "Orders", query: "Show sales orders" },
    { label: "Purchase orders", query: "Show purchase orders" },
  ],
  trainer: [
    { label: "Needs coaching", query: "Who needs coaching?" },
    { label: "Alex", query: "How is Alex doing?" },
    { label: "Call score", query: "What was Alex's last Cascade call score?" },
    { label: "Role-plays", query: "Show recent role-plays" },
  ],
};

const DOMAIN_COPY: Record<AssistantDomain, { title: string; blurb: string }> = {
  all: {
    title: "Ask anything",
    blurb: "One place to query CRM, ERP, and the sales trainer in plain language.",
  },
  crm: {
    title: "Ask CRM",
    blurb: "Pipeline, deals, accounts, and contacts — without leaving the sentence.",
  },
  erp: {
    title: "Ask ERP",
    blurb: "Quotes, orders, invoices, purchasing, catalog, and finance.",
  },
  trainer: {
    title: "Ask sales trainer",
    blurb: "Call scores, role-plays, assignments, and who needs help next.",
  },
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function QueryWorkspace() {
  const [domain, setDomain] = useState<AssistantDomain>("all");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const started = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [domain]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setInput("");
    const userMsg: Msg = { id: uid(), role: "user", content: message };
    startTransition(() => setMessages((prev) => [...prev, userMsg]));
    setPending(true);
    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, domain }),
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
          sources: data.sources,
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

  const copy = DOMAIN_COPY[domain];
  const examples = EXAMPLES[domain];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-8 h-72 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.18),_transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-size-[28px_28px]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col">
        <div
          className={`transition-all duration-500 ease-out ${
            started ? "pt-2 pb-4" : "flex-1 flex flex-col justify-center pb-8 pt-6"
          }`}
        >
          <div className={`mx-auto w-full max-w-3xl ${started ? "" : "text-center"}`}>
            <p
              className={`text-[11px] uppercase tracking-[0.22em] text-accent-hover/90 mb-3 transition-opacity duration-300 ${
                started ? "opacity-70" : "opacity-100"
              }`}
            >
              SalesCoach · Query
            </p>
            <h1
              className={`font-semibold tracking-tight text-foreground transition-all duration-500 ${
                started ? "text-xl mb-1" : "text-4xl sm:text-5xl mb-3"
              }`}
            >
              {copy.title}
            </h1>
            {!started && (
              <p className="text-muted text-base sm:text-lg max-w-xl mx-auto leading-relaxed sc-fade-in">
                {copy.blurb}
              </p>
            )}
          </div>

          <div className="mx-auto mt-6 w-full max-w-3xl">
            <DomainTabs value={domain} onChange={setDomain} />

            <form
              className="mt-5 group"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <div className="relative rounded-2xl border border-line bg-surface/90 shadow-[0_0_0_1px_rgba(99,102,241,0.08)] focus-within:border-accent/45 focus-within:shadow-[0_0_0_1px_rgba(99,102,241,0.35)] transition-all duration-300">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={started ? 2 : 3}
                  placeholder={
                    domain === "crm"
                      ? "e.g. Show me the Cascade deal…"
                      : domain === "erp"
                        ? "e.g. List open quotes…"
                        : domain === "trainer"
                          ? "e.g. What was Alex's last Cascade call score?…"
                          : "Ask about pipeline, quotes, call scores, or coaching…"
                  }
                  className="w-full resize-none bg-transparent px-5 pt-4 pb-14 text-[15px] leading-relaxed outline-none placeholder:text-muted/70"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-3 pb-3">
                  <span className="text-[11px] text-muted px-2">
                    Enter to send · Shift+Enter for newline
                  </span>
                  <button
                    type="submit"
                    disabled={pending || !input.trim()}
                    className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-all hover:bg-accent-hover disabled:opacity-40 active:scale-[0.98]"
                  >
                    {pending ? "Querying…" : "Ask"}
                  </button>
                </div>
              </div>
            </form>

            {!started && (
              <div className="mt-6 grid gap-2 sm:grid-cols-2 sc-fade-in">
                {examples.map((ex) => (
                  <button
                    key={ex.query}
                    type="button"
                    disabled={pending}
                    onClick={() => void send(ex.query)}
                    className="group/ex text-left rounded-xl border border-transparent px-4 py-3 transition-all hover:border-line hover:bg-surface-2/70"
                  >
                    <div className="text-[11px] uppercase tracking-wider text-muted mb-1 group-hover/ex:text-accent-hover transition-colors">
                      {ex.label}
                    </div>
                    <div className="text-sm text-foreground/90">{ex.query}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {started && (
          <div className="mx-auto w-full max-w-3xl flex-1 pb-8 sc-fade-in">
            <div className="space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} sc-fade-in`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-accent text-white rounded-br-md"
                        : "bg-surface border border-line text-foreground rounded-bl-md"
                    }`}
                  >
                    <ReplyBody content={m.content} invert={m.role === "user"} />
                    <SourceBadges sources={m.sources} />
                    <ReplyLinks links={m.links} />
                    {m.mode === "demo" && m.role === "assistant" && (
                      <div className="mt-2 text-[10px] text-muted/80">Demo router · live seeded data</div>
                    )}
                  </div>
                </div>
              ))}
              {pending && (
                <div className="flex items-center gap-2 text-sm text-muted px-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                  Searching {domain === "all" ? "CRM, ERP, and trainer" : SOURCE_LABEL[domain]}…
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {messages.length >= 2 && !pending && (
              <div className="mt-6 flex flex-wrap gap-2">
                {examples.slice(0, 4).map((ex) => (
                  <button
                    key={ex.query}
                    type="button"
                    onClick={() => void send(ex.query)}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-accent/40 transition-colors"
                  >
                    {ex.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
