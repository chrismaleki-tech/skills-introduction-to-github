"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

type LinkItem = { href: string; label: string };
type Source = "crm" | "erp" | "trainer";
type Domain = "all" | Source;

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  links?: LinkItem[];
  sources?: Source[];
  mode?: "demo" | "llm";
};

const SOURCE_LABEL: Record<Source, string> = {
  crm: "CRM",
  erp: "ERP",
  trainer: "Sales trainer",
};

const SOURCE_TONE: Record<Source, string> = {
  crm: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  erp: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  trainer: "border-amber-400/30 bg-amber-400/10 text-amber-200",
};

const EXAMPLES: Record<Domain, { label: string; query: string }[]> = {
  all: [
    { label: "Pipeline health", query: "What's our pipeline look like?" },
    { label: "Cascade deal", query: "Show me the Cascade deal" },
    { label: "Open quotes", query: "List open quotes" },
    { label: "Finance", query: "Finance snapshot" },
    { label: "Coaching queue", query: "Who needs coaching?" },
    { label: "Low stock", query: "What's low in inventory?" },
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
    { label: "Inventory", query: "What's low in inventory?" },
  ],
  trainer: [
    { label: "Needs coaching", query: "Who needs coaching?" },
    { label: "Alex", query: "How is Alex doing?" },
    { label: "Team scores", query: "Team coaching summary" },
    { label: "Assignments", query: "Show assignments" },
  ],
};

const DOMAIN_COPY: Record<Domain, { title: string; blurb: string }> = {
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
    blurb: "Quotes, orders, invoices, catalog, inventory, and finance.",
  },
  trainer: {
    title: "Ask sales trainer",
    blurb: "Coaching scores, assignments, and who needs help next.",
  },
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function SourceBadges({ sources }: { sources?: Source[] }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {sources.map((s) => (
        <span
          key={s}
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide ${SOURCE_TONE[s]}`}
        >
          {SOURCE_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

export function QueryWorkspace() {
  const [domain, setDomain] = useState<Domain>("all");
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
            <div
              className="flex flex-wrap items-center gap-1 border-b border-line pb-3"
              role="tablist"
              aria-label="System scope"
            >
              {(
                [
                  ["all", "All systems"],
                  ["crm", "CRM"],
                  ["erp", "ERP"],
                  ["trainer", "Sales trainer"],
                ] as const
              ).map(([key, label]) => {
                const active = domain === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setDomain(key)}
                    className={`relative px-3 py-1.5 text-sm transition-colors ${
                      active ? "text-foreground" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {label}
                    {active && (
                      <span className="absolute inset-x-2 -bottom-[13px] h-0.5 rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
            </div>

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
                          ? "e.g. Who needs coaching?…"
                          : "Ask about pipeline, quotes, inventory, or coaching…"
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
                    className={`max-w-[92%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-accent text-white rounded-br-md"
                        : "bg-surface border border-line text-foreground rounded-bl-md"
                    }`}
                  >
                    {m.content}
                    <SourceBadges sources={m.sources} />
                    {m.links && m.links.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {m.links.map((l) => (
                          <Link
                            key={l.href + l.label}
                            href={l.href}
                            className="inline-flex rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] text-accent-hover hover:bg-accent/20 transition-colors"
                          >
                            {l.label} →
                          </Link>
                        ))}
                      </div>
                    )}
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
