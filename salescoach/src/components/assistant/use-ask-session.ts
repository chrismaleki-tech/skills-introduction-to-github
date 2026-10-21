"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { AssistantDomain, AssistantLinkItem, AssistantSource } from "@/components/assistant/reply";

export type AskMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  links?: AssistantLinkItem[];
  sources?: AssistantSource[];
  mode?: "demo" | "llm";
  data?: AskResultData | null;
  followUps?: string[];
  pending?: boolean;
};

export type AskResultData =
  | {
      kind: "pipeline";
      count: number;
      total: number;
      weighted: number;
      stages?: { label: string; count: number; value: number }[];
    }
  | {
      kind: "finance";
      openQuoteCount: number;
      openQuoteValue: number;
      openOrderCount: number;
      openOrderValue: number;
      arBalance: number;
      arCount: number;
      revenue: number;
      products: number;
      lowStockCount: number;
    }
  | { kind: "generic"; rows: { label: string; value: string }[] };

type SessionState = {
  domain: AssistantDomain;
  messages: AskMsg[];
  updatedAt: number;
};

const STORAGE_KEY = "sc_ask_session_v1";
const CHANNEL = "sc_ask_session";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultState(): SessionState {
  return { domain: "all", messages: [], updatedAt: 0 };
}

/** Stable SSR snapshot — must be referentially equal across calls. */
const SERVER_SNAPSHOT: SessionState = { domain: "all", messages: [], updatedAt: 0 };

function readState(): SessionState {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as SessionState;
    if (!parsed || !Array.isArray(parsed.messages)) return defaultState();
    return {
      domain: parsed.domain || "all",
      messages: parsed.messages.map((m) => ({ ...m, pending: false })),
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch {
    return defaultState();
  }
}

function writeState(state: SessionState) {
  if (typeof window === "undefined") return;
  const next = { ...state, updatedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CHANNEL, { detail: next }));
}

let memory: SessionState = defaultState();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function getSnapshot() {
  return memory;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setMemory(next: SessionState) {
  memory = next;
  emit();
}

if (typeof window !== "undefined") {
  memory = readState();
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      setMemory(readState());
    }
  });
  window.addEventListener(CHANNEL, ((e: CustomEvent<SessionState>) => {
    if (e.detail) setMemory(e.detail);
  }) as EventListener);
}

export function useAskSession() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMemory(readState());
    setHydrated(true);
  }, []);

  const setDomain = useCallback((domain: AssistantDomain) => {
    const next = { ...memory, domain, updatedAt: Date.now() };
    writeState(next);
    setMemory(next);
  }, []);

  const clear = useCallback(() => {
    const next = { domain: memory.domain, messages: [], updatedAt: Date.now() };
    writeState(next);
    setMemory(next);
  }, []);

  const setMessages = useCallback((updater: (prev: AskMsg[]) => AskMsg[]) => {
    const messages = updater(memory.messages);
    const next = { ...memory, messages, updatedAt: Date.now() };
    writeState(next);
    setMemory(next);
  }, []);

  return {
    hydrated,
    domain: state.domain,
    messages: state.messages,
    setDomain,
    setMessages,
    clear,
    uid,
  };
}

export type StreamChatResult = {
  reply: string;
  links?: AssistantLinkItem[];
  sources?: AssistantSource[];
  mode?: "demo" | "llm";
  data?: AskResultData | null;
  followUps?: string[];
};

export async function streamAssistantChat(input: {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  domain: AssistantDomain;
  onToken: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<StreamChatResult> {
  const res = await fetch("/api/assistant/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      message: input.message,
      history: input.history,
      domain: input.domain,
      stream: true,
    }),
    signal: input.signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Assistant failed.");
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !res.body) {
    const data = (await res.json()) as StreamChatResult;
    if (data.reply) input.onToken(data.reply);
    return data;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: StreamChatResult = { reply: "" };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const lines = part.split("\n");
      let event = "message";
      let dataLine = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;
      const payload = JSON.parse(dataLine) as Record<string, unknown>;
      if (event === "token" && typeof payload.text === "string") {
        input.onToken(payload.text);
        result.reply += payload.text;
      }
      if (event === "meta") {
        result = {
          ...result,
          links: payload.links as AssistantLinkItem[] | undefined,
          sources: payload.sources as AssistantSource[] | undefined,
          mode: payload.mode as "demo" | "llm" | undefined,
          data: (payload.data as AskResultData | null | undefined) ?? null,
          followUps: payload.followUps as string[] | undefined,
        };
      }
      if (event === "error") {
        throw new Error(String(payload.error || "Stream failed."));
      }
    }
  }

  return result;
}
