# SalesCoach AI

Unified sales platform: AI call coaching + role-play, built-in CRM, sales-ops ERP, and a natural-language Ask workspace — one product, one codebase.

This repository previously held an AWS data-pipeline exercise (`part1_data_sourcing` … `part4_infrastructure`). That work remains under those folders for reference. **The active product is `salescoach/`.**

## Quick start

```bash
cd salescoach
npm install
npm run db:push     # create SQLite dev database
npm run db:seed     # demo tenant with CRM, ERP, graded calls, role-plays
npm run dev         # http://localhost:3000
```

Open [http://localhost:3000/login](http://localhost:3000/login) (demo password `password123`), then try:

- **Ask** — `/ask` natural-language queries across CRM, ERP, and coaching
- **Pipeline** — CRM deals, accounts, contacts
- **ERP** — quotes → orders → invoices, inventory, GL, HR
- **Calls / Role-Play / Dashboard** — coaching loop

No API keys required for demo mode. Optional: `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, `VAPI_WEBHOOK_SECRET` (see `salescoach/.env.example`).

## What’s in this unified build

| Segment | Source agent work | Status |
|---|---|---|
| Sales training (grading, role-play, dashboard) | PR #56 | Included |
| CRM + channels | PR #57 | Included (+ pre-prod hardening) |
| ERP (quote→cash, warehouses, GL, HR, projects) | PR #58 | Included |
| Natural-language Ask view | PR #59 | Included |

Full product docs: [`salescoach/README.md`](salescoach/README.md).

## Project layout

```
salescoach/                 # ← primary app (Next.js + Prisma)
part1_data_sourcing/        # legacy AWS BLS sync (reference)
part2_api_integration/      # legacy Population API (reference)
part3_analytics/            # legacy analytics notebook (reference)
part4_infrastructure/       # legacy CDK pipeline (reference)
shared/                     # shared utils for legacy pipeline
```

## Related open work (not in this PR)

- [PR #60 — Data Golf extract pipeline](https://github.com/chrismaleki-tech/skills-introduction-to-github/pull/60) is a separate product line; keep it on its own branch/repo rather than mixing it into SalesCoach.
