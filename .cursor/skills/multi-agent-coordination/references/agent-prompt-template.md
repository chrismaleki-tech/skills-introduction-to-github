# Segment agent prompt template

Copy, fill brackets, launch one agent per section.

## Shared header (identical for every agent)

```text
You are one segment agent on a shared product — not a greenfield app.

Repo: chrismaleki-tech/skills-introduction-to-github
Base branch: cursor/unify-salescoach-segments-59c7
Product root: salescoach/
Primary docs: salescoach/README.md (do not replace the root README with a different product)

Rules:
1. Branch from the Base branch tip only.
2. Open your PR against that same Base branch (or main once Base is merged).
3. Touch only the paths listed under "You own" below.
4. Never create a sibling top-level app (no new packages that compete with salescoach/).
5. For schema / nav / auth / seed changes: propose the minimal shared diff and call it out; do not fork a parallel data model.
6. After pull/rebase conflicts in files you do not own, prefer the integration tip and re-apply only your section.
7. Keep commits scoped to your section.
```

## Ownership blocks (pick one per agent)

### Coaching / training

```text
You own ONLY:
- salescoach/src/app/(app)/calls/**
- salescoach/src/app/(app)/roleplay/**
- salescoach/src/app/(app)/dashboard/**
- salescoach/src/app/(app)/me/**
- salescoach/src/app/(app)/assignments/**
- salescoach/src/app/(app)/scenarios/**
- salescoach/src/app/(app)/rubrics/**
- salescoach/src/app/(app)/calibration/**
- salescoach/src/app/(app)/company/**
- salescoach/src/lib/{grading,scoring,sampling,pipeline,transcription,roleplay}*.ts
- related components under salescoach/src/components/{calls,roleplay,dashboard,rubrics}/**

Task: <describe coaching work>
```

### CRM

```text
You own ONLY:
- salescoach/src/app/(app)/crm/**
- salescoach/src/app/(app)/conversations/**
- salescoach/src/app/(app)/channels/**
- salescoach/src/lib/{crm,crm-match,channels}*.ts
- salescoach/src/components/crm/**
- CRM-related API routes under salescoach/src/app/api/crm/** and channels/conversations APIs

Task: <describe CRM work>
```

### ERP

```text
You own ONLY:
- salescoach/src/app/(app)/erp/**
- salescoach/src/lib/erp*.ts
- salescoach/src/components/erp/**
- salescoach/src/app/api/erp/**

Task: <describe ERP work>
```

### Ask / natural language

```text
You own ONLY:
- salescoach/src/app/(app)/ask/**
- salescoach/src/components/assistant/**
- salescoach/src/lib/assistant.ts
- salescoach/src/app/api/assistant/**

Task: <describe Ask/assistant work>
```

## Optional: different product in same repo

If the work is **not** SalesCoach (e.g. Data Golf), say so explicitly:

```text
This is a SEPARATE product line from SalesCoach.
Do not put code under salescoach/.
Do not merge SalesCoach PRs into this work or vice versa.
Own: datagolf/**, related workflows only.
```
