"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import type { RoleplayMessage } from "@/lib/types";
import { RoleplayChat } from "./chat";

// Live voice role-play. The browser opens a WebRTC call straight to OpenAI's
// Realtime API using a short-lived client secret minted by our server (the
// API key never reaches the browser). Turn-taking, barge-in and transcription
// happen server-side; the browser keeps the running transcript and syncs it
// to /api/roleplay/[id]/transcript so the session can be graded like a text one.
//
// Echo handling: the mic track is opened with echoCancellation on, and the
// prospect's audio is played through the same WebRTC peer connection, so the
// browser's AEC removes it from the uplink. That is what keeps the AI's own
// voice from being transcribed as a rep turn.

type CallState =
  | "idle"
  | "requesting_mic"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "reconnecting"
  | "ended";

type CallError = {
  kind: "unsupported" | "mic_denied" | "no_mic" | "mic_busy" | "connect" | "autoplay" | "server" | "limit";
  message: string;
  billingUrl?: string;
};

type UsageInfo = { remainingSeconds: number | null; limitSeconds: number | null };

const LOW_MINUTES_WARNING_SEC = 5 * 60;

type Turn = RoleplayMessage & { id: string; order: number; final: boolean };

const SYNC_DEBOUNCE_MS = 1500;
const SYNC_HEARTBEAT_MS = 15000;
const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export function VoiceRoleplay({
  sessionId,
  initialMessages,
  personaName,
  personaTitle,
  personaCompany,
  repName,
  startedAtIso,
}: {
  sessionId: string;
  initialMessages: RoleplayMessage[];
  personaName: string;
  personaTitle?: string;
  personaCompany?: string;
  repName: string;
  startedAtIso: string;
}) {
  const router = useRouter();
  const startedAtMs = useMemo(() => new Date(startedAtIso).getTime(), [startedAtIso]);

  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<CallError | null>(null);
  const [muted, setMuted] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [ending, setEnding] = useState<"grading" | "notEnough" | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [useText, setUseText] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  // Workspace allowance as last reported by the server; counted down locally
  // between heartbeats for display only.
  const [usage, setUsage] = useState<UsageInfo>({ remainingSeconds: null, limitSeconds: null });
  const [cutoff, setCutoff] = useState<"allowance_exhausted" | "trial_expired" | null>(null);
  const [turns, setTurns] = useState<Turn[]>(() =>
    initialMessages.map((m, i) => ({ ...m, id: `seed_${i}`, order: i, final: true })),
  );

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const turnsRef = useRef<Turn[]>(turns);
  const orderRef = useRef(initialMessages.length);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSynced = useRef<string>(JSON.stringify(initialMessages));
  const stateRef = useRef<CallState>("idle");
  const mutedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    turnsRef.current = turns;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const tick = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAtMs]);

  const inCallNow = state !== "idle" && state !== "ended";
  useEffect(() => {
    if (!inCallNow) return;
    const t = setInterval(() => {
      setUsage((u) =>
        u.remainingSeconds === null ? u : { ...u, remainingSeconds: Math.max(0, u.remainingSeconds - 1) },
      );
    }, 1000);
    return () => clearInterval(t);
  }, [inCallNow]);

  const messagesForServer = useCallback(
    (): RoleplayMessage[] =>
      [...turnsRef.current]
        .sort((a, b) => a.order - b.order)
        .filter((t) => t.text.trim())
        .map(({ role, text, atMs }) => ({ role, text: text.trim(), atMs })),
    [],
  );

  const repTurns = turns.filter((t) => t.role === "rep" && t.text.trim()).length;

  // --- Transcript bookkeeping -------------------------------------------------

  const upsertTurn = useCallback(
    (id: string, role: "rep" | "prospect", patch: { text?: string; append?: string; final?: boolean }) => {
      setTurns((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx === -1) {
          const turn: Turn = {
            id,
            role,
            order: orderRef.current++,
            atMs: Math.max(0, Date.now() - startedAtMs),
            text: patch.text ?? patch.append ?? "",
            final: patch.final ?? false,
          };
          return [...prev, turn];
        }
        const next = [...prev];
        const cur = next[idx];
        next[idx] = {
          ...cur,
          text: patch.text !== undefined ? patch.text : patch.append ? cur.text + patch.append : cur.text,
          final: patch.final ?? cur.final,
        };
        return next;
      });
    },
    [startedAtMs],
  );

  // --- Teardown -----------------------------------------------------------------

  const hangUp = useCallback(() => {
    if (heartbeat.current) clearInterval(heartbeat.current);
    heartbeat.current = null;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = null;
    try {
      dcRef.current?.close();
    } catch {}
    dcRef.current = null;
    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.srcObject = null;
    }
    setUserSpeaking(false);
  }, []);

  // Grade what was captured after the server ended the call for us. The
  // transcript is already saved; /end grades a COMPLETED session as-is.
  const finishAfterCutoff = useCallback(async () => {
    const enough = messagesForServer().filter((m) => m.role === "rep").length >= 2;
    if (!enough) {
      setEnding("notEnough");
      return;
    }
    setEnding("grading");
    try {
      const res = await fetch(`/api/roleplay/${sessionId}/end`, { method: "POST" });
      if (res.ok) {
        router.push(`/roleplay/${sessionId}`);
        router.refresh();
        return;
      }
    } catch {}
    setEnding(null);
  }, [messagesForServer, router, sessionId]);

  const syncNow = useCallback(
    async (opts: { keepalive?: boolean; heartbeat?: boolean } = {}): Promise<boolean> => {
      const messages = messagesForServer();
      const body = JSON.stringify({ messages });
      // Heartbeats always go out: each one is the liveness signal the server
      // meters against, even when the transcript has not changed.
      if (!opts.heartbeat && body === lastSynced.current) return true;
      try {
        const res = await fetch(`/api/roleplay/${sessionId}/transcript`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: opts.keepalive,
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          billingUrl?: string;
          ended?: "allowance_exhausted" | "trial_expired";
          remainingSeconds?: number | null;
          limitSeconds?: number | null;
        };
        if (data.remainingSeconds !== undefined && data.limitSeconds !== undefined) {
          setUsage({ remainingSeconds: data.remainingSeconds, limitSeconds: data.limitSeconds });
        }
        if (res.status === 402) {
          // The server saved the transcript and ended the session (shared
          // allowance used up, or the trial expired). Stop audio and the mic
          // now so nothing else accrues, then grade what we have.
          lastSynced.current = body;
          hangUp();
          setState("ended");
          setCutoff(data.ended ?? "allowance_exhausted");
          setError({
            kind: "limit",
            message: data.error ?? "Your workspace has used all of its AI Role Play minutes, so this call has ended.",
            billingUrl: data.billingUrl,
          });
          void finishAfterCutoff();
          return false;
        }
        if (res.ok) lastSynced.current = body;
        return res.ok;
      } catch {
        return false;
      }
    },
    [finishAfterCutoff, hangUp, messagesForServer, sessionId],
  );

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => void syncNow(), SYNC_DEBOUNCE_MS);
  }, [syncNow]);

  useEffect(() => {
    if (state === "idle" || state === "ended") return;
    scheduleSync();
  }, [turns, state, scheduleSync]);

  useEffect(() => {
    const onPageHide = () => {
      if (stateRef.current !== "idle" && stateRef.current !== "ended") {
        const payload = new Blob([JSON.stringify({ messages: messagesForServer() })], { type: "application/json" });
        navigator.sendBeacon?.(`/api/roleplay/${sessionId}/transcript`, payload);
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      hangUp();
    };
  }, [hangUp, messagesForServer, sessionId]);

  // --- Realtime events ------------------------------------------------------------

  const sendEvent = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") dc.send(JSON.stringify(event));
  }, []);

  const handleServerEvent = useCallback(
    (raw: string) => {
      let ev: { type?: string; item_id?: string; item?: { id?: string }; transcript?: string; delta?: string; error?: { message?: string } };
      try {
        ev = JSON.parse(raw);
      } catch {
        return;
      }
      switch (ev.type) {
        case "input_audio_buffer.speech_started":
          setUserSpeaking(true);
          // Barge-in: the server cancels the in-flight response and clears
          // the output buffer; reflect that immediately in the UI.
          setState("listening");
          break;
        case "input_audio_buffer.speech_stopped":
          setUserSpeaking(false);
          break;
        case "input_audio_buffer.committed":
          if (ev.item_id) upsertTurn(ev.item_id, "rep", {});
          break;
        case "conversation.item.input_audio_transcription.delta":
          if (ev.item_id && ev.delta) upsertTurn(ev.item_id, "rep", { append: ev.delta });
          break;
        case "conversation.item.input_audio_transcription.completed":
          if (ev.item_id) upsertTurn(ev.item_id, "rep", { text: ev.transcript ?? "", final: true });
          break;
        case "conversation.item.input_audio_transcription.failed":
          if (ev.item_id) upsertTurn(ev.item_id, "rep", { text: "[inaudible]", final: true });
          break;
        case "response.created":
          setState("thinking");
          break;
        case "output_audio_buffer.started":
          setState("speaking");
          break;
        case "response.output_audio_transcript.delta":
          if (ev.item_id && ev.delta) upsertTurn(ev.item_id, "prospect", { append: ev.delta });
          break;
        case "response.output_audio_transcript.done":
          if (ev.item_id) upsertTurn(ev.item_id, "prospect", { text: ev.transcript ?? "", final: true });
          break;
        case "output_audio_buffer.stopped":
        case "output_audio_buffer.cleared":
          setState((s) => (s === "speaking" || s === "thinking" ? "listening" : s));
          break;
        case "response.done":
          setState((s) => (s === "thinking" ? "listening" : s));
          break;
        case "error":
          console.warn("[voice] realtime error", ev.error);
          break;
        default:
          break;
      }
    },
    [upsertTurn],
  );

  // Replays the transcript so far into the new Realtime session (used on
  // resume/reconnect), then kicks off the prospect if it is their turn.
  const primeConversation = useCallback(() => {
    const history = messagesForServer();
    for (const m of history) {
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: m.role === "rep" ? "user" : "assistant",
          content: [m.role === "rep" ? { type: "input_text", text: m.text } : { type: "output_text", text: m.text }],
        },
      });
    }
    const last = history[history.length - 1];
    if (!last) {
      sendEvent({
        type: "response.create",
        response: {
          instructions:
            "The phone just connected and you are picking up. Answer the call the way this persona would — one short sentence, like a real busy person answering an unknown number — then stop and wait for the caller.",
        },
      });
    } else if (last.role === "rep") {
      sendEvent({ type: "response.create" });
    } else {
      sendEvent({
        type: "response.create",
        response: {
          instructions: "The line dropped for a moment and is back. Say one very short thing to pick the conversation back up, then wait.",
        },
      });
    }
  }, [messagesForServer, sendEvent]);

  // --- Connect ----------------------------------------------------------------------

  const connect = useCallback(
    async (resume: boolean) => {
      setError(null);
      setNeedsTap(false);
      if (typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError({
          kind: "unsupported",
          message: "This browser does not support live voice calls. Use a current version of Chrome, Edge, Safari or Firefox, or switch to the text role-play.",
        });
        return;
      }

      // Unlock audio playback inside the user gesture (needed on iOS Safari).
      const audio = audioRef.current;
      if (audio) {
        audio.muted = false;
        audio.play().catch(() => {});
      }

      setState(resume ? "reconnecting" : "requesting_mic");
      let mic: MediaStream;
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError({
            kind: "mic_denied",
            message: "Microphone access was blocked. Allow the microphone for this site in your browser's address bar, then try again.",
          });
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setError({ kind: "no_mic", message: "No microphone was found. Plug one in or use a headset, then try again." });
        } else if (name === "NotReadableError" || name === "AbortError") {
          setError({
            kind: "mic_busy",
            message: "The microphone is in use by another app or tab. Close it and try again.",
          });
        } else {
          setError({ kind: "mic_denied", message: "Could not access the microphone. Check your browser settings and try again." });
        }
        setState("idle");
        return;
      }
      micRef.current = mic;
      mic.getAudioTracks().forEach((t) => (t.enabled = !mutedRef.current));

      setState("connecting");
      let token: { clientSecret: string };
      try {
        const res = await fetch(`/api/roleplay/${sessionId}/voice/token`, { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as {
          clientSecret?: string;
          error?: string;
          code?: string;
          billingUrl?: string;
          remainingSeconds?: number | null;
          limitSeconds?: number | null;
        };
        if (data.remainingSeconds !== undefined && data.limitSeconds !== undefined) {
          setUsage({ remainingSeconds: data.remainingSeconds, limitSeconds: data.limitSeconds });
        }
        if (!res.ok || !data.clientSecret) {
          hangUp();
          setError({
            kind: res.status === 402 ? "limit" : "server",
            message: data.error ?? "Could not start the voice call.",
            billingUrl: data.billingUrl,
          });
          setState("idle");
          return;
        }
        token = { clientSecret: data.clientSecret };
      } catch {
        hangUp();
        setError({ kind: "connect", message: "Network error while starting the call. Check your connection and try again." });
        setState("idle");
        return;
      }

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.ontrack = (e) => {
        const el = audioRef.current;
        if (!el) return;
        el.srcObject = e.streams[0];
        el.play().catch(() => setNeedsTap(true));
      };
      mic.getTracks().forEach((t) => pc.addTrack(t, mic));
      let dropTimer: ReturnType<typeof setTimeout> | null = null;
      const dropped = () => {
        if (pcRef.current !== pc) return;
        hangUp();
        setError({ kind: "connect", message: "The call dropped. Reconnect to pick up where you left off." });
        setState("idle");
      };
      pc.onconnectionstatechange = () => {
        if (dropTimer) clearTimeout(dropTimer);
        dropTimer = null;
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          if (pc.connectionState === "failed") dropped();
        } else if (pc.connectionState === "disconnected") {
          dropTimer = setTimeout(() => {
            if (pc.connectionState === "disconnected") dropped();
          }, 4000);
        }
      };

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = (e) => handleServerEvent(String(e.data));
      dc.onopen = () => {
        setState("listening");
        primeConversation();
        if (heartbeat.current) clearInterval(heartbeat.current);
        heartbeat.current = setInterval(() => void syncNow({ heartbeat: true }), SYNC_HEARTBEAT_MS);
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const sdpRes = await fetch(REALTIME_CALLS_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${token.clientSecret}`, "Content-Type": "application/sdp" },
          body: offer.sdp,
        });
        if (!sdpRes.ok) throw new Error(`Realtime handshake failed (${sdpRes.status})`);
        const answer = await sdpRes.text();
        if (pcRef.current !== pc) return; // ended while connecting
        await pc.setRemoteDescription({ type: "answer", sdp: answer });
      } catch (err) {
        if (pcRef.current !== pc) return;
        hangUp();
        setError({
          kind: "connect",
          message: `Could not connect to the voice service${err instanceof Error ? ` (${err.message})` : ""}. Try again, or switch to text.`,
        });
        setState("idle");
      }
    },
    [handleServerEvent, hangUp, primeConversation, sessionId, syncNow],
  );

  // --- Controls -----------------------------------------------------------------------

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    micRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
  }, []);

  const endCall = useCallback(async () => {
    if (ending) return;
    hangUp();
    setState("ended");
    const enough = messagesForServer().filter((m) => m.role === "rep").length >= 2;
    if (!enough) {
      await syncNow({ keepalive: true, heartbeat: true });
      setEnding("notEnough");
      return;
    }
    setEnding("grading");
    const synced = await syncNow({ keepalive: true, heartbeat: true });
    if (!synced) {
      if (cutoff) return; // the server ended the call; finishAfterCutoff grades it
      // Retry once; if the transcript still is not saved, do not grade a stale copy.
      const again = await syncNow({ keepalive: true });
      if (!again) {
        setError((e) => e ?? { kind: "server", message: "Could not save the transcript. Check your connection and try End again." });
        setEnding(null);
        setState("idle");
        return;
      }
    }
    try {
      const res = await fetch(`/api/roleplay/${sessionId}/end`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; billingUrl?: string };
      if (!res.ok) {
        setError({ kind: res.status === 402 ? "limit" : "server", message: data.error ?? "Could not grade the session. Try again.", billingUrl: data.billingUrl });
        setEnding(null);
        setState("idle");
        return;
      }
      router.push(`/roleplay/${sessionId}`);
      router.refresh();
    } catch {
      setError({ kind: "server", message: "Network error while ending the session. Try again." });
      setEnding(null);
      setState("idle");
    }
  }, [cutoff, ending, hangUp, messagesForServer, router, sessionId, syncNow]);

  const sendTyped = useCallback(() => {
    const text = typed.trim();
    if (!text || stateRef.current === "idle" || stateRef.current === "ended") return;
    const id = `typed_${Date.now().toString(36)}`;
    upsertTurn(id, "rep", { text, final: true });
    sendEvent({
      type: "conversation.item.create",
      item: { id, type: "message", role: "user", content: [{ type: "input_text", text }] },
    });
    sendEvent({ type: "response.create" });
    setTyped("");
  }, [sendEvent, typed, upsertTurn]);

  const switchToText = useCallback(async () => {
    hangUp();
    setState("ended");
    await fetch(`/api/roleplay/${sessionId}/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messagesForServer(), switchToText: true }),
      keepalive: true,
    }).catch(() => {});
    setUseText(true);
  }, [hangUp, messagesForServer, sessionId]);

  const resumeAfterNotEnough = useCallback(() => {
    setEnding(null);
    void connect(true);
  }, [connect]);

  const remaining = usage.remainingSeconds;
  const lowMinutes = remaining !== null && remaining <= LOW_MINUTES_WARNING_SEC;

  const inCall = state !== "idle" && state !== "ended";
  const orderedTurns = useMemo(() => [...turns].sort((a, b) => a.order - b.order), [turns]);

  if (useText) {
    return (
      <RoleplayChat
        sessionId={sessionId}
        initialMessages={orderedTurns.filter((t) => t.text.trim()).map(({ role, text, atMs }) => ({ role, text: text.trim(), atMs }))}
        personaName={personaName}
        repName={repName}
        startedAtIso={startedAtIso}
      />
    );
  }

  return (
    <div className="bg-surface border border-line rounded-xl flex flex-col">
      {/* Hidden sink for the prospect's audio track. */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      <div className="flex flex-col items-start justify-between gap-1 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
        <div className="text-sm font-medium">
          Live call with <span className="text-brand">{personaName || "the prospect"}</span>
          {(personaTitle || personaCompany) && (
            <span className="text-muted font-normal"> · {[personaTitle, personaCompany].filter(Boolean).join(", ")}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted tabular-nums sm:gap-4">
          <span>{fmtClock(elapsedSec)} elapsed</span>
          {remaining !== null && (
            <span className={lowMinutes ? "font-semibold text-amber-700" : ""} title="AI Role Play minutes left for your whole workspace">
              {fmtClock(remaining)} left
            </span>
          )}
          <span>
            {repTurns} {repTurns === 1 ? "turn" : "turns"}
          </span>
        </div>
      </div>

      {lowMinutes && inCall && !cutoff && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 sm:px-5" role="status">
          {remaining <= 0
            ? "Your workspace's AI Role Play minutes are about to run out; the call will end and be graded automatically."
            : `About ${Math.max(1, Math.ceil(remaining / 60))} min of AI Role Play left for your workspace. The call ends automatically when they run out; wrap up your next step.`}
        </div>
      )}

      {/* Call stage */}
      <div className="flex flex-col items-center gap-5 px-4 py-8 sm:py-10">
        <StateOrb state={state} muted={muted} userSpeaking={userSpeaking} personaName={personaName} />
        <div className="text-center">
          <div className="text-base font-medium">{stateTitle(state, muted, userSpeaking, personaName, ending)}</div>
          <p className="mt-1 max-w-md text-sm text-muted">{stateHint(state, muted, ending, cutoff !== null)}</p>
        </div>

        {needsTap && inCall && (
          <Button
            variant="secondary"
            onClick={() => {
              audioRef.current?.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
            }}
          >
            Tap to enable audio
          </Button>
        )}

        {error && (
          <div className="w-full max-w-lg rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800" role="alert">
            <div>{error.message}</div>
            {cutoff && (
              <div className="mt-1 text-xs text-rose-700">
                {cutoff === "trial_expired"
                  ? "Your microphone and the prospect's audio have been stopped. Everything said so far is saved."
                  : "Your microphone and the prospect's audio have been stopped. Everything said so far is saved; upgrading to Pro or Max adds per-seat monthly minutes."}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {error.kind === "limit" && (
                <a href={error.billingUrl ?? "/billing"} className="font-medium underline underline-offset-2">
                  Upgrade or view plan &amp; usage
                </a>
              )}
              {error.kind === "mic_denied" && (
                <span className="text-rose-700">
                  Chrome/Edge: click the lock or camera icon in the address bar → Microphone → Allow. Safari: Safari menu → Settings for this website → Microphone → Allow.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex w-full max-w-md flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
          {!inCall && ending !== "notEnough" && !cutoff && (
            <Button onClick={() => void connect(turns.length > 0)} disabled={ending === "grading"} className="sm:min-w-44">
              <MicIcon />
              {error?.kind === "connect" || turns.length > 0 ? "Reconnect & continue" : "Start call"}
            </Button>
          )}
          {inCall && (
            <>
              <Button variant="secondary" onClick={toggleMute} aria-pressed={muted} className="sm:min-w-36">
                {muted ? <MicOffIcon /> : <MicIcon />}
                {muted ? "Unmute" : "Mute"}
              </Button>
              <Button variant="danger" onClick={() => void endCall()} disabled={ending !== null} className="sm:min-w-44">
                <PhoneOffIcon />
                {repTurns >= 2 ? "End call & get graded" : "End call"}
              </Button>
            </>
          )}
          {ending === "notEnough" && !cutoff && (
            <>
              <Button onClick={resumeAfterNotEnough} className="sm:min-w-40">
                <MicIcon />
                Resume call
              </Button>
              <Button variant="secondary" onClick={() => router.push("/roleplay")}>
                Leave for now
              </Button>
            </>
          )}
          {ending === "notEnough" && cutoff && (
            <Button variant="secondary" onClick={() => router.push("/roleplay")}>
              Back to role-plays
            </Button>
          )}
        </div>

        {!inCall && ending === null && !cutoff && (
          <button type="button" onClick={() => void switchToText()} className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline">
            Can&apos;t use a microphone right now? Switch to the text role-play
          </button>
        )}
        {inCall && (
          <button type="button" onClick={() => setShowTyping((v) => !v)} className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline">
            {showTyping ? "Hide typing" : "Need to type something instead?"}
          </button>
        )}
        {inCall && showTyping && (
          <div className="flex w-full max-w-lg flex-col gap-2 sm:flex-row">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendTyped();
                }
              }}
              maxLength={2000}
              placeholder="Type a line — the prospect will answer out loud"
              className="flex-1 rounded-lg bg-surface-2 border border-line px-3 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:border-accent"
            />
            <Button variant="secondary" onClick={sendTyped} disabled={!typed.trim()}>
              Send
            </Button>
          </div>
        )}
      </div>

      {/* Live transcript (secondary) */}
      <div className="border-t border-line">
        <div className="flex items-center justify-between px-4 py-2.5 sm:px-5">
          <div className="text-xs font-medium uppercase tracking-wider text-muted">Live transcript</div>
          <div className="text-xs text-muted">
            {inCall ? "Saved automatically" : turns.length === 0 ? "Appears once the call starts" : ""}
          </div>
        </div>
        <div ref={scrollRef} className="max-h-64 space-y-2.5 overflow-y-auto px-3 pb-4 sm:max-h-80 sm:px-5">
          {orderedTurns.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">
              {inCall ? "Waiting for the first words..." : "Start the call — the prospect will pick up, then deliver your opener."}
            </p>
          )}
          {orderedTurns.map((t) => (
            <div key={t.id} className={`flex ${t.role === "rep" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[92%] break-words rounded-xl px-3.5 py-2 text-sm whitespace-pre-wrap sm:max-w-[80%] ${
                  t.role === "rep" ? "bg-brand/10 border border-brand/25" : "bg-surface-2 border border-line"
                } ${t.final ? "" : "opacity-80"}`}
              >
                <div className={`mb-0.5 text-xs font-medium ${t.role === "rep" ? "text-brand" : "text-muted"}`}>
                  {t.role === "rep" ? repName : personaName || "Prospect"}
                </div>
                {t.text || <span className="italic text-muted">{t.role === "rep" ? "Transcribing..." : "..."}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Presentation helpers ---------------------------------------------------------------

function stateTitle(
  state: CallState,
  muted: boolean,
  userSpeaking: boolean,
  personaName: string,
  ending: "grading" | "notEnough" | null,
): string {
  if (ending === "grading") return "Grading your call...";
  if (ending === "notEnough") return "Call ended before it really got going";
  switch (state) {
    case "idle":
      return "Ready to call";
    case "requesting_mic":
      return "Waiting for microphone access";
    case "connecting":
      return "Connecting...";
    case "reconnecting":
      return "Reconnecting...";
    case "listening":
      if (muted) return "Muted";
      return userSpeaking ? "Listening — you're speaking" : "Listening — go ahead";
    case "thinking":
      return `${personaName || "The prospect"} is thinking...`;
    case "speaking":
      return `${personaName || "The prospect"} is speaking`;
    case "ended":
      return "Call ended";
  }
}

function stateHint(state: CallState, muted: boolean, ending: "grading" | "notEnough" | null, cutoff = false): string {
  if (ending === "grading") return "Saving the transcript and running it through the grading engine.";
  if (ending === "notEnough" && cutoff) return "Grading needs at least two of your turns, so this short call was saved without a score.";
  if (ending === "notEnough") return "Grading needs at least two of your turns. Resume the call to keep going, or come back later — the session stays open.";
  switch (state) {
    case "idle":
      return "You'll be asked for microphone access. Headphones give the cleanest audio; speak naturally and feel free to interrupt.";
    case "requesting_mic":
      return "Choose Allow in the browser prompt.";
    case "connecting":
    case "reconnecting":
      return "Setting up a secure audio connection.";
    case "listening":
      return muted ? "Your microphone is off — the prospect can't hear you." : "Speak naturally. The prospect responds when you pause.";
    case "thinking":
      return "Jump in any time — you can talk over them.";
    case "speaking":
      return "You can interrupt just like on a real call.";
    case "ended":
      return "";
  }
}

function StateOrb({
  state,
  muted,
  userSpeaking,
  personaName,
}: {
  state: CallState;
  muted: boolean;
  userSpeaking: boolean;
  personaName: string;
}) {
  const initial = (personaName || "P").trim().charAt(0).toUpperCase();
  const ring =
    state === "speaking"
      ? "ring-8 ring-brand/25 animate-pulse"
      : state === "thinking"
        ? "ring-8 ring-amber-200/70 animate-pulse"
        : state === "listening" && userSpeaking && !muted
          ? "ring-8 ring-emerald-200"
          : state === "listening"
            ? "ring-4 ring-emerald-100"
            : state === "connecting" || state === "reconnecting" || state === "requesting_mic"
              ? "ring-4 ring-line animate-pulse"
              : "ring-4 ring-line";
  const fill =
    state === "speaking" ? "bg-brand text-white" : state === "ended" ? "bg-surface-2 text-muted" : "bg-surface-2 text-foreground";
  return (
    <div className={`relative flex h-24 w-24 items-center justify-center rounded-full text-3xl font-semibold transition-all sm:h-28 sm:w-28 ${fill} ${ring}`} aria-hidden="true">
      {initial}
      {muted && state !== "idle" && state !== "ended" && (
        <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white shadow">
          <MicOffIcon />
        </span>
      )}
    </div>
  );
}

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
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

function MicOffIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M15 9.5V6a3 3 0 0 0-5.7-1.3" />
      <path d="M9 9v5a3 3 0 0 0 5.1 2.1" />
      <path d="M5 11a7 7 0 0 0 11.3 5.5" />
      <path d="M19 11a7 7 0 0 1-.6 2.8" />
      <path d="M12 18v3" />
    </svg>
  );
}

function PhoneOffIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.7 13.3a15 15 0 0 1-2.6-3.6l2-2a1 1 0 0 0 .2-1L9.3 3.3A1 1 0 0 0 8.3 2.6H5a2 2 0 0 0-2 2.1 17 17 0 0 0 4.4 9.9" />
      <path d="M14.2 16.4a17 17 0 0 0 4.7 2.5 2 2 0 0 0 2.1-2v-3.3a1 1 0 0 0-.7-1l-3.4-1a1 1 0 0 0-1 .2l-1.9 1.9" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
