# SalesCoach AI

AI sales training platform: reps upload (or auto-ingest) real phone calls and practice against an AI role-play prospect; both are graded 0–100 against a configurable methodology rubric grounded in the company's own products, objections, and competitors; managers track team progress on a coaching dashboard.

## Quick start

```bash
npm install
npm run db:push     # create SQLite dev database
npm run db:seed     # demo tenant: 5 reps, CRM pipeline, ERP quote→cash, graded calls, role-plays
npm run dev         # http://localhost:3000
```

No API keys are required: without `OPENAI_API_KEY` the platform runs in demo mode with a deterministic heuristic grader and a scripted role-play prospect, so every flow is usable immediately. Use the user switcher (bottom of the sidebar) to experience each role — manager, trainer, admin, and reps.

**Natural-language demo:** open [http://localhost:3000/ask](http://localhost:3000/ask), pick a system tab (or leave **All systems**), and try the example prompts.

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

**Phase 5 — CRM connected to SalesCoach.** Built-in CRM with accounts, contacts, and a deal pipeline (lead → closed). Calls link to deals; deal stage / account context grounds grading feedback; scorecards write back as `COACHING` activities on the deal timeline. Bridge endpoints: `POST /api/crm/sync/call` (CRM → SalesCoach) and call CRM linking (`POST /api/calls/[id]/crm`). Dialer webhooks also accept optional `dealId` / `contactId` / `accountId`.

**Phase 6 — Employee email & phone channels.** Each user connects their work email and/or phone under **Channels** (demo inbox/dialer, or Gmail/Outlook/Twilio/Aircall-shaped providers). From a deal, **Email prospect** and **Call prospect** send from the connected address; full threads live in Conversations (on the deal and in the global Conversations page). Demo email auto-captures a prospect reply; phone calls are graded by SalesCoach and appear in the same conversation history.

**Phase 7 — ERP replacement (sales ops).** Full quote→order→invoice→payment loop inside the same tenant as CRM and coaching:

| Module | What it does |
|---|---|
| **Catalog** | SKUs with list price, cost, unit, category — feeds every quote line |
| **Quotes** | Draft/send/accept/reject; accepting creates a sales order and writes `QUOTE` activities on the deal |
| **Orders** | Confirm (marks CRM deal closed-won), fulfill (decrements tracked inventory), invoice |
| **Invoices + payments** | AR documents with partial/full payment recording and `PAYMENT` timeline events |
| **Inventory** | On-hand / reserved / reorder; balances roll up from warehouses |
| **Warehouses** | Multi-location stock, bins, and inter-warehouse transfers |
| **Purchasing** | Vendors, PO approval, partial/full goods receipts, matched vendor bills (AP) |
| **General ledger** | Chart of accounts, journals from invoices/payments/bills/payroll, trial balance, CSV export |
| **Projects & time** | Implementation projects linked to CRM deals with billable time |
| **HR & payroll** | Employee roster and monthly payroll accrual journals |
| **ERP settings** | Base currency, tax codes, FX rates applied to commercial documents |
| **Finance hub** | Cash collected, AR balance, open order book, low-stock alerts |

Deal pages show live ERP documents and a one-click quote builder. Grading prompts include open quote/order/invoice state so coaching stays grounded in commercial reality (`src/lib/erp.ts`, `src/lib/erp-deep.ts` + pipeline enrichment).

**Phase 8 — Natural-language Ask.** Floating **Ask SalesCoach** chat on every page plus a full-page **Ask** workspace at `/ask`. Scope queries to **All systems**, **CRM**, **ERP**, or **Sales trainer**, then ask in plain English — e.g. “What's our pipeline?”, “Show Cascade”, “Accept the Cascade quote”, “Who needs coaching?”, “Finance snapshot”, “Trial balance”, “Warehouse stock”. Answers include source badges and deep links into the matching module. Demo mode uses a deterministic intent router; with `OPENAI_API_KEY` it uses LLM tool-calling against the same live tools (`src/lib/assistant.ts`, `POST /api/assistant/chat`).

**Phase 10 — Platform admin console.** Cross-tenant maintenance UI at `/admin`, gated on the `PLATFORM_ADMIN_EMAILS` allowlist (org-level ADMINs manage only their own org via Settings). Overview tab shows environment/integration status, platform totals, job-queue health, and 30-day usage across all tenants. Organizations tab lists every tenant with a create-org form (one-time temporary admin password) and per-org drill-down: users (with role changes and password resets — fixing the "invited without a password" gap), invite-user form, and per-tenant usage. Jobs tab filters the durable queue with per-job retry and a "run pending now" drain. Presets tab installs the global methodology library onto a fresh production database without running the destructive demo seed.

**Phase 9 — Pre-production hardening.** Password login at `/login` (demo password `password123`), middleware route protection, unmatched-rep webhook queue, CRM auto-match by email/phone/name, PII redaction + retention sweeps, durable job queue for grading, outbound email coaching, manager calibration dashboard, drag-and-drop pipeline, contact detail outreach, and voice role-play start (demo completes without Vapi).

## Architecture notes

- **Grading is a pure function** of (transcript + rubric + company context [+ optional CRM/ERP deal context]) — `src/lib/grading.ts` — so uploaded calls and role-plays are directly comparable, and the voice layer is swappable without touching anything downstream.
- **CRM write-back** (`src/lib/crm.ts`) upserts a coaching activity keyed by `grade:<id>` whenever a linked call is graded or a manager overrides the score.
- **ERP write-back** (`src/lib/erp.ts`) upserts `QUOTE` / `ORDER` / `INVOICE` / `PAYMENT` / `PO` activities with stable `externalRef` keys; quote accept → order → invoice is the canonical commercial path.
- **Ask / platform assistant** (`src/lib/assistant.ts`, `/ask`, floating chat) exposes the same domain operations as tools over `POST /api/assistant/chat`, with optional CRM/ERP/trainer domain scoping.
- **Channels** (`src/lib/channels.ts`) own connect/send/dial; demo providers persist conversations locally; real OAuth tokens would replace `credentialsJson`.
- **Jobs** (`src/lib/queue.ts`) persist PROCESS_CALL / GRADE_EMAIL / GRADE_ROLEPLAY / RETENTION_SWEEP rows; set `INLINE_JOBS=true` to run synchronously.
- **Sampling** logic is pure and unit-testable in `src/lib/sampling.ts`; the pipeline orchestration lives in `src/lib/pipeline.ts`.
- **Auth**: password sessions via `/login`; demo user switcher only when `ALLOW_DEMO_SWITCHER` is enabled (default outside production).
- **SQLite in dev**; the Prisma schema is Postgres-portable (JSON payloads are stored as strings with typed parse helpers in `src/lib/types.ts`).

## CRM ↔ SalesCoach ↔ ERP connection

| Direction | How |
|---|---|
| CRM → coaching | From a deal, **Call prospect** (or `POST /api/crm/sync/call`) ingests through the same pipeline as uploads |
| Employee email | Connect inbox in **Channels**, then **Email prospect** on a deal — threads stored as Conversation + Message |
| Employee phone | Connect dialer in **Channels**, then **Call prospect** — call logged in CRM and graded by SalesCoach |
| Coaching → CRM | Graded linked calls upsert a `COACHING` activity on the deal/account timeline with score, band, and summary |
| ERP → CRM | Quote/order/invoice/payment events land on the same deal timeline; confirming an order closes the deal won |
| Context enrich | Linked deal stage, amount, product, account, contact, **and open ERP documents** are injected into the grading prompt |
| Auto-match | Prospect email/phone/name maps to contacts and open deals on ingest |
| Manual link | Call review page → **CRM link** panel attaches an existing call to a deal |
| Quote from deal | Deal detail → **Create quote for this deal** uses catalog SKUs and advances stage toward proposal |

## Pre-production checklist

| Area | Status |
|---|---|
| Signed session cookies (`SESSION_SECRET`) | ✅ Required in production |
| Password login + middleware | ✅ |
| Demo switcher disabled in production | ✅ Default off when `NODE_ENV=production` |
| Unmatched ingest queue (webhook + CRM sync) | ✅ |
| PII redaction + retention (incl. audio delete) | ✅ |
| Durable job queue + `npm run jobs:worker` | ✅ (swap to BullMQ/SQS later if needed) |
| S3-compatible object storage | ✅ When `S3_*` env set; else local `uploads/` |
| Live Vapi voice create + webhook grade | ✅ When `VAPI_API_KEY` set |
| Channel provider gating (SMTP/Twilio/OAuth env) | ✅ Demo vs live paths separated |
| Usage metering events | ✅ Settings + `/api/admin/usage` |
| Team invite / multi-org create | ✅ `/api/admin/users`, `/api/admin/orgs` |
| Platform admin console | ✅ `/admin` — orgs, users, jobs, presets (needs `PLATFORM_ADMIN_EMAILS`) |
| Health endpoint | ✅ `/api/health` |
| Unit tests (`npm test`) | ✅ Sampling, PII, sessions, providers |

## Still external / optional integrations

Full Gmail/Outlook OAuth token exchange UI, Salesforce/HubSpot bidirectional sync, SSO (WorkOS/SAML), and Stripe billing checkout are not bundled — env-gated stubs and metering events are in place so those vendors can be wired without schema rewrites. Grading calibration against human-scored calls remains a product process — the Calibration page captures the data for it.

### Production run

```bash
export SESSION_SECRET="$(openssl rand -base64 48)"
export ALLOW_DEMO_SWITCHER=false
export DATABASE_URL="postgresql://..."   # or keep SQLite for single-node
npm run db:push && npm run build
npm run start                            # web
npm run jobs:worker                      # background jobs + retention cron
```
