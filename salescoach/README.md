# SalesCoach AI

AI sales training platform: reps upload (or auto-ingest) real phone calls and practice against an AI role-play prospect; both are graded 0–100 against a configurable methodology rubric grounded in the company's own products, objections, and competitors; managers track team progress on a coaching dashboard.

## Marketing site

The public site lives at `/` (blue & white HubSpot-style branding):

- Landing page with product screenshots, how-it-works, **$50/mo** pricing, and demo lead form
- Privacy policy at `/privacy` (for Google Ads)
- Lead capture API: `POST /api/leads`
- Product demo: `/dashboard` (and the rest of the app)

## Quick start

```bash
npm install
npm run db:push     # create SQLite dev database
npm run db:seed     # demo tenant: 5 reps, ~7 weeks of graded calls, role-plays, assignments
npm run dev         # http://localhost:3000  (marketing) · http://localhost:3000/dashboard (app)
```

No API keys are required: without `OPENAI_API_KEY` the platform runs in demo mode with a deterministic heuristic grader and a scripted role-play prospect, so every flow is usable immediately. Use the user switcher (bottom of the sidebar) to experience each role — manager, trainer, admin, and reps.

### Optional environment (`.env`)

| Variable | Enables |
|---|---|
| `OPENAI_API_KEY` (+ `OPENAI_MODEL`) | Real LLM grading and a live role-play persona |
| `DEEPGRAM_API_KEY` | Real audio transcription with speaker diarization |
| `VAPI_WEBHOOK_SECRET` | Voice role-play ingestion via the Vapi webhook |

## What's implemented

**Phase 0 — grading foundation.** Rubric system with four methodology presets (Discovery Fundamentals, MEDDIC, SPIN, Challenger), each with weighted dimensions and written 1–5 level descriptions. Clone a preset, edit weights, add company-specific dimensions. One active rubric per team. Scores roll up to 0–100 (`src/lib/scoring.ts`) with bands: 90+ Exceptional, 75–89 Strong, 60–74 Developing, <60 Needs coaching. Mechanical metrics (talk ratio, questions, monologues, fillers, interruptions) are computed deterministically and shown alongside — never part of the score.

**Company context layer.** Editable profile (products, value props, buyer personas, objection library with approved responses, competitor battlecards, talk tracks) that grounds every grade and generates role-play scenarios ("Generate from company profile" on the scenario builder).

**Phase 1 — call ingestion and grading.** Manual upload (audio or pasted transcript), generic webhook (`POST /api/ingest/webhook`, secret per org, dedup on external id), inline processing pipeline (transcribe → grade → store). Per-rep sampling policy as locked: calls under the minimum duration are skipped; reps at or below the monthly threshold (default 10) get everything graded; above it, a stratified random sample (default 10/month) spread through the month. Rep-flagged, manager-requested, and manual uploads always grade. Call review page: transcript, audio player, full scorecard with timestamped quotes, manager score override + comment, "grade this call now" for unsampled calls.

**Phase 2 — AI role-play.** Text role-play against a persona-driven AI prospect (LLM when configured, scripted engine otherwise), scenario library + builder with difficulty and win conditions, sessions graded through the same engine and rubric as calls. Voice mode is production-shaped but stubbed: the Vapi end-of-call webhook (`/api/vapi/webhook`) maps voice transcripts into the same grading path.

**Phase 3 — manager dashboard.** Team stats with month-over-month deltas, 8-week score trend (calls vs role-plays), skill heatmap (reps × rubric dimensions), leaderboard, per-rep sampling coverage strip, "needs coaching" list, rep drill-downs, rep-facing "My Performance" page, and assignments (role-play or upload tasks with live progress).

**Phase 4 — roles and settings.** Rep/manager/trainer/admin roles with org-scoped access control, ingestion policy editor, webhook secret rotation, engine status panel.

## Architecture notes

- **Grading is a pure function** of (transcript + rubric + company context) — `src/lib/grading.ts` — so uploaded calls and role-plays are directly comparable, and the voice layer is swappable without touching anything downstream.
- **Sampling** logic is pure and unit-testable in `src/lib/sampling.ts`; the pipeline orchestration lives in `src/lib/pipeline.ts`.
- **Demo auth**: a cookie + user switcher stands in for a real auth provider. Production would swap `src/lib/session.ts` for NextAuth/WorkOS and add tenant-scoped middleware.
- **SQLite in dev**; the Prisma schema is Postgres-portable (JSON payloads are stored as strings with typed parse helpers in `src/lib/types.ts`).
- **Inline processing in dev**; production moves transcription/grading behind a queue (SQS/BullMQ) — the pipeline entry points are already the natural job boundaries.

## Not yet implemented (known gaps)

Native dialer integrations (Aircall/RingCentral/etc. — the webhook is the integration surface for now), real authentication/SSO, PII redaction, unmatched-rep review queue for webhook calls, voice role-play session initiation UI, billing/metering, and multi-org admin. Grading calibration against human-scored calls is a product process, not code — the manager override loop captures the data for it.
