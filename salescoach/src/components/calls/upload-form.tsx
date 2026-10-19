"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import {
  audioLimitLabel,
  MAX_AUDIO_BYTES,
  MAX_TRANSCRIPT_CHARS,
} from "@/lib/upload-limits";

// Manual upload form. Managers get a rep selector so they can upload on
// behalf of their team; reps upload for themselves.

const CALL_TYPES = [
  { value: "cold_call", label: "Cold call" },
  { value: "discovery", label: "Discovery" },
  { value: "demo", label: "Demo" },
  { value: "negotiation", label: "Negotiation" },
  { value: "renewal", label: "Renewal" },
];

const inputCls =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";

export function UploadForm({
  reps,
  currentUserId,
}: {
  reps: { id: string; name: string }[]; // empty for non-managers
  currentUserId: string;
}) {
  const router = useRouter();
  const [prospectName, setProspectName] = useState("");
  const [callType, setCallType] = useState("discovery");
  const [direction, setDirection] = useState("outbound");
  const [repId, setRepId] = useState(currentUserId);
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [mode, setMode] = useState<"audio" | "transcript">("audio");
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationSec = (Number(minutes) || 0) * 60 + (Number(seconds) || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (durationSec <= 0) {
      setError("Enter the call duration.");
      return;
    }
    if (mode === "audio" && !file) {
      setError("Choose an audio file, or switch to pasting a transcript.");
      return;
    }
    if (mode === "transcript" && !transcript.trim()) {
      setError("Paste a transcript, or switch to uploading an audio file.");
      return;
    }
    if (file && file.size > MAX_AUDIO_BYTES) {
      setError(`Audio files must be no larger than ${audioLimitLabel()}.`);
      return;
    }
    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      setError(`Transcript is too long (maximum ${MAX_TRANSCRIPT_CHARS.toLocaleString()} characters).`);
      return;
    }

    const form = new FormData();
    form.set("prospectName", prospectName);
    form.set("callType", callType);
    form.set("direction", direction);
    form.set("durationSec", String(durationSec));
    if (repId !== currentUserId) form.set("repId", repId);
    if (mode === "transcript") form.set("transcript", transcript);

    setPending(true);
    try {
      if (mode === "audio" && file) {
        const contentType = file.type || mimeForFile(file.name);
        const direct = await fetch("/api/calls/upload-url", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            contentType,
            size: file.size,
            repId,
            durationSec,
          }),
        });
        const upload = (await direct.json().catch(() => null)) as
          | { uploadUrl?: string; audioRef?: string; error?: string }
          | null;
        if (direct.ok && upload?.uploadUrl && upload.audioRef) {
          const put = await fetch(upload.uploadUrl, {
            method: "PUT",
            headers: { "content-type": contentType },
            body: file,
          });
          if (!put.ok) {
            setError("Audio storage upload failed. Check the storage CORS configuration and try again.");
            return;
          }
          form.set("audioRef", upload.audioRef);
          form.set("audioMimeType", contentType);
        } else if (direct.status === 503) {
          // Local development can still use the multipart fallback.
          form.set("audio", file);
        } else {
          setError(upload?.error ?? "Could not prepare the audio upload.");
          return;
        }
      }
      const res = await fetch("/api/calls/upload", { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as
        | { callId?: string; error?: string }
        | null;
      if (!res.ok || !data?.callId) {
        setError(data?.error ?? "Upload failed. Try again.");
        return;
      }
      router.push(`/calls/${data.callId}`);
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="up-prospect" className="block text-xs text-muted mb-1">
            Prospect / company
          </label>
          <input
            id="up-prospect"
            value={prospectName}
            onChange={(e) => setProspectName(e.target.value)}
            placeholder="Acme Logistics"
            className={inputCls}
          />
        </div>
        {reps.length > 0 && (
          <div>
            <label htmlFor="up-rep" className="block text-xs text-muted mb-1">
              Rep on the call
            </label>
            <select id="up-rep" value={repId} onChange={(e) => setRepId(e.target.value)} className={inputCls}>
              <option value={currentUserId}>Myself</option>
              {reps
                .filter((r) => r.id !== currentUserId)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="up-type" className="block text-xs text-muted mb-1">
            Call type
          </label>
          <select id="up-type" value={callType} onChange={(e) => setCallType(e.target.value)} className={inputCls}>
            {CALL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="up-direction" className="block text-xs text-muted mb-1">
            Direction
          </label>
          <select
            id="up-direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            className={inputCls}
          >
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
          </select>
        </div>
        <div>
          <span className="block text-xs text-muted mb-1">Duration</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="8"
              aria-label="Duration minutes"
              className={`${inputCls} w-20`}
            />
            <span className="text-xs text-muted">min</span>
            <input
              type="number"
              min={0}
              max={59}
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              placeholder="30"
              aria-label="Duration seconds"
              className={`${inputCls} w-20`}
            />
            <span className="text-xs text-muted">sec</span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex gap-1 rounded-lg border border-line bg-surface-2 p-1 w-fit mb-3">
          <ModeTab active={mode === "audio"} onClick={() => setMode("audio")}>
            Audio file
          </ModeTab>
          <ModeTab active={mode === "transcript"} onClick={() => setMode("transcript")}>
            Paste transcript
          </ModeTab>
        </div>

        {mode === "audio" ? (
          <div>
            <input
              type="file"
              accept=".mp3,.wav,.m4a,.webm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              aria-label="Audio file"
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-line file:cursor-pointer"
            />
            <p className="text-xs text-muted mt-2">
              mp3, wav, m4a or webm, up to {audioLimitLabel()}. Files upload directly to encrypted durable storage.
            </p>
          </div>
        ) : (
          <div>
            <textarea
              rows={10}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              maxLength={MAX_TRANSCRIPT_CHARS}
              placeholder={"REP: Hi, this is Jordan from Meridian — did I catch you at an okay time?\nPROSPECT: You've got about two minutes, go ahead."}
              aria-label="Transcript"
              className={`${inputCls} font-mono text-xs resize-y`}
            />
            <p className="text-xs text-muted mt-2">
              One utterance per line, prefixed with the speaker: <code className="text-foreground/80">REP:</code> or{" "}
              <code className="text-foreground/80">PROSPECT:</code> (AGENT/CUSTOMER also work). A JSON segments array
              is accepted too.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading and grading…" : "Upload call"}
        </Button>
        {error && <span className="text-xs text-rose-700">{error}</span>}
      </div>
      <p className="text-xs leading-relaxed text-muted">
        By uploading, you confirm that your organization has the required permission and recording consent for this
        conversation. Audio and transcripts are processed by the providers described in our Privacy Policy.
      </p>
    </form>
  );
}

function mimeForFile(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "m4a") return "audio/mp4";
  if (ext === "webm") return "audio/webm";
  return "application/octet-stream";
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-accent text-white" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
