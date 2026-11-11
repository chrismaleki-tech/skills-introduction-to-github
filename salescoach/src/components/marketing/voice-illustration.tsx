// Static, clearly labelled illustration of a live voice role-play. Mirrors
// the real session screen (prospect, scenario, call state, transcript, mic
// controls) but nothing here is interactive — it is a picture, not a demo.

const TURNS = [
  { who: "prospect", text: "Dana speaking. I've got about five minutes." },
  { who: "you", text: "Appreciate it. Quick one — how are you handling count drift between the two warehouses today?" },
  { who: "prospect", text: "Honestly? Spreadsheets and a lot of phone calls. Why, what are you seeing?" },
] as const;

export function VoiceIllustration({ className = "" }: { className?: string }) {
  return (
    <figure className={`relative min-w-0 ${className}`} aria-labelledby="voice-illustration-caption">
      <div className="rounded-2xl border border-line bg-white p-4 shadow-[0_30px_80px_-40px_rgba(45,62,80,0.45)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Live call with Dana Whitfield</div>
            <div className="mt-1 truncate text-sm font-semibold text-marketing-ink">Discovery: COO at Northgate Distribution</div>
            <div className="mt-0.5 text-xs text-muted">Skeptical · Intermediate · Goal: uncover two pain points, book a demo</div>
          </div>
          <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand">
            Illustration
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-3">
          <span aria-hidden="true" className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15">
            <span className="mkt-pulse absolute inset-0 rounded-full border-2 border-brand/40" />
            <span className="h-4 w-4 rounded-full bg-brand" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-marketing-ink">Listening — go ahead</div>
            <div className="text-xs text-muted">Speak naturally. Interrupt whenever you would on a real call.</div>
          </div>
          <span aria-hidden="true" className="ml-auto flex h-6 items-end gap-[3px]">
            {[8, 14, 20, 12, 16, 9, 18].map((h, i) => (
              <span key={i} className="mkt-bar w-[3px] rounded-full bg-brand" style={{ height: h, animationDelay: `${i * 90}ms` }} />
            ))}
          </span>
        </div>

        <ol className="mt-4 space-y-2.5" aria-label="Example transcript">
          {TURNS.map((t, i) => (
            <li key={i} className={`flex ${t.who === "you" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  t.who === "you" ? "bg-accent text-white" : "bg-surface-2 text-marketing-ink"
                }`}
              >
                <span className={`mb-0.5 block text-[10px] font-bold uppercase tracking-wide ${t.who === "you" ? "text-white/70" : "text-muted"}`}>
                  {t.who === "you" ? "You" : "Dana"}
                </span>
                {t.text}
              </div>
            </li>
          ))}
        </ol>

        <div aria-hidden="true" className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row">
          <span className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-white text-sm font-medium text-marketing-ink">
            <MicIcon /> Mute
          </span>
          <span className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-marketing-ink text-sm font-medium text-white">
            End call &amp; get graded
          </span>
        </div>
      </div>
      <figcaption id="voice-illustration-caption" className="mt-3 text-center text-xs text-muted">
        Illustrative interface based on the live role-play screen. Not interactive.
      </figcaption>
    </figure>
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

// Compact illustration of the post-call scorecard layout for the walkthrough.
export function FeedbackIllustration() {
  const rows: [string, number][] = [
    ["Opening & rapport", 4],
    ["Discovery questions", 4],
    ["Objection handling", 2],
    ["Next-step close", 3],
  ];
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden p-4 sm:p-5">
      <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Overall</div>
            <div className="mt-0.5 font-display text-2xl font-semibold text-marketing-ink">68 <span className="text-sm font-medium text-muted">/ 100</span></div>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Developing</span>
        </div>
        <ul className="mt-3 space-y-2">
          {rows.map(([label, score]) => (
            <li key={label} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-marketing-ink">{label}</span>
              <span className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= score ? "bg-brand" : "bg-surface-2"}`} />
                ))}
                <span className="ml-1 tabular-nums text-muted">{score}/5</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-lg bg-surface-2/70 p-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Work on next</div>
          <p className="mt-0.5 text-xs font-medium text-marketing-ink">Clarify the objection before answering it.</p>
        </div>
      </div>
    </div>
  );
}
