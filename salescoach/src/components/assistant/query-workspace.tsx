"use client";

import { useEffect, useRef, useState } from "react";
import {
  DomainTabs,
  MessageActions,
  ReplyBody,
  ReplyLinks,
  ResultCard,
  SourceBadges,
  SOURCE_LABEL,
  type AssistantDomain,
} from "./reply";
import { streamAssistantChat, useAskSession } from "./use-ask-session";

/** Example chips reference the tenant's own account/rep when provided. */
function buildExamples(
  account: string | null,
  rep: string | null,
): Record<AssistantDomain, { label: string; query: string }[]> {
  const acct = account ?? null;
  const callScore =
    rep && acct
      ? { label: "Call score", query: `What was ${rep}'s last ${acct} call score?` }
      : { label: "Role-plays", query: "Show recent role-plays" };
  return {
    all: [
      { label: "Pipeline health", query: "What's our pipeline look like?" },
      ...(acct ? [{ label: `${acct} deal`, query: `Show me the ${acct} deal` }] : []),
      { label: "Open quotes", query: "List open quotes" },
      { label: "Finance", query: "Finance snapshot" },
      { label: "Coaching queue", query: "Who needs coaching?" },
      callScore,
    ],
    crm: [
      { label: "Pipeline", query: "What's our pipeline look like?" },
      ...(acct
        ? [
            { label: acct, query: `Show me the ${acct} deal` },
            { label: "Move stage", query: `Move ${acct} to negotiation` },
            { label: "Timeline", query: `Show ${acct} activity timeline` },
          ]
        : [{ label: "Accounts", query: "List accounts" }]),
    ],
    erp: [
      { label: "Finance", query: "Finance snapshot" },
      { label: "Quotes", query: "List open quotes" },
      { label: "Quote detail", query: "Show details for Q-1001" },
      { label: "Purchase orders", query: "Show purchase orders" },
    ],
    trainer: [
      { label: "Needs coaching", query: "Who needs coaching?" },
      { label: "My performance", query: "How am I doing?" },
      callScore,
      { label: "Scenarios", query: "List scenarios" },
    ],
  };
}

const DOMAIN_COPY: Record<AssistantDomain, { title: string; blurb: string }> = {
  all: {
    title: "Ask anything",
    blurb: "One place to query CRM, ERP, and the sales trainer in plain language.",
  },
  crm: {
    title: "Ask CRM",
    blurb: "Pipeline, deals, stage moves, timelines, and conversations.",
  },
  erp: {
    title: "Ask ERP",
    blurb: "Quotes, orders, invoices, purchasing, catalog, and finance.",
  },
  trainer: {
    title: "Ask sales trainer",
    blurb: "Call scores, role-plays, scenarios, assignments, and your performance.",
  },
};

export function QueryWorkspace({
  exampleAccount = null,
  exampleRep = null,
}: {
  exampleAccount?: string | null;
  exampleRep?: string | null;
}) {
  const { hydrated, domain, setDomain, messages, setMessages, clear, uid } = useAskSession();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
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
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
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

  const copy = DOMAIN_COPY[domain];
  const examples = buildExamples(exampleAccount, exampleRep)[domain];
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && !m.pending);
  const followUps = lastAssistant?.followUps?.length
    ? lastAssistant.followUps
    : examples.slice(0, 4).map((e) => e.query);

  if (!hydrated) {
    return <div className="min-h-[40vh] flex items-center justify-center text-muted text-sm">Loading Ask…</div>;
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-8 h-72 overflow-hidden">
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
            <p className="text-[11px] uppercase tracking-[0.22em] text-accent-hover/90 mb-3">
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
              className="mt-5"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <div className="relative rounded-2xl border border-line bg-surface/90 focus-within:border-accent/45 transition-all duration-300">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={started ? 2 : 3}
                  placeholder={
                    domain === "crm"
                      ? `e.g. Move ${exampleAccount ?? "a deal"} to negotiation…`
                      : domain === "erp"
                        ? "e.g. Show details for Q-1001…"
                        : domain === "trainer"
                          ? "e.g. How am I doing?…"
                          : "Ask about pipeline, quotes, call scores, or coaching…"
                  }
                  className="w-full resize-none bg-transparent px-4 sm:px-5 pt-4 pb-14 text-[15px] leading-relaxed outline-none placeholder:text-muted/70"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-3 pb-3">
                  <span className="text-[11px] text-muted px-2 hidden sm:inline">
                    Enter to send · history syncs with the floating chat
                  </span>
                  <div className="flex gap-2 ml-auto">
                    {pending && (
                      <button
                        type="button"
                        onClick={() => abortRef.current?.abort()}
                        className="rounded-xl border border-line px-3 py-2 text-sm text-muted hover:text-foreground"
                      >
                        Stop
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={pending || !input.trim()}
                      className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
                    >
                      {pending ? "Streaming…" : "Ask"}
                    </button>
                  </div>
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
                    <div className="text-[11px] uppercase tracking-wider text-muted mb-1 group-hover/ex:text-accent-hover">
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
                    <ReplyBody content={m.content || (m.pending ? "…" : "")} invert={m.role === "user"} />
                    {!m.pending && m.role === "assistant" && (
                      <>
                        <ResultCard data={m.data} />
                        <SourceBadges sources={m.sources} />
                        <ReplyLinks links={m.links} />
                        <MessageActions
                          content={m.content}
                          onRegenerate={() => {
                            const idx = messages.findIndex((x) => x.id === m.id);
                            const prevUser = [...messages.slice(0, idx)].reverse().find((x) => x.role === "user");
                            if (prevUser) void send(prevUser.content);
                          }}
                        />
                        {m.mode === "demo" && (
                          <div className="mt-2 text-[10px] text-muted/80">Demo router · live seeded data</div>
                        )}
                      </>
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

            {!pending && (
              <div className="mt-6 flex flex-wrap gap-2">
                {followUps.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-accent/40 transition-colors"
                  >
                    {q}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clear}
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
