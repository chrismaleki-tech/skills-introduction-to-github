---
name: multi-agent-coordination
description: >
  Coordinate multiple Cursor cloud agents on one shared repo so each owns only
  its section. Use when launching parallel agents, splitting a product into
  segments (CRM/ERP/Ask/etc.), or when agents risk creating separate projects.
---

# Multi-agent coordination (one project, many sections)

Keep several agents on **the same product** while each edits **only its lane**.

## Failure mode this skill prevents

Agents that all start from the same GitHub repo but each:
- fork `main` independently,
- invent a new top-level app or rewrite the root README as a different product,
- never share one integration tip,

…will look like separate projects. Same repo ≠ same project.

## Before launching parallel agents

1. **Establish one shared base first** (one agent or human):
   - Create/scaffold the real product root (e.g. `salescoach/`)
   - Land it on an integration branch or `main`
   - Agree shared contracts: schema, auth/session, nav, seed shape
2. **Only then** fan out segment agents from that tip — not from a stale or unrelated `main`.

## Required prompt contract (paste into every segment agent)

```text
Repo: <owner/repo>
Base branch: <integration-branch-or-main>
Product root: <app-dir>/ only   # e.g. salescoach/
You own ONLY these paths:
  - <path-glob-1>
  - <path-glob-2>
Do NOT:
  - create a new top-level app or package
  - rewrite the root README as a different product
  - edit other agents' paths except a tiny shared type/import
  - open a PR against a random historical fork — target the shared base
If you need a cross-cutting change (schema, nav, auth), stop and note it
instead of inventing a parallel module.
```

Customize the ownership globs per agent. Keep the rest identical.

## Branch / PR shape

```text
main  (or shared integration branch)
  ├── PR: agent A  (only its paths)
  ├── PR: agent B  (only its paths)
  └── PR: agent C  (only its paths)
```

Rules:
- Every agent bases work on the **same current tip**
- Every PR targets that shared branch
- Merge often; next agent pulls/rebases before continuing
- Prefer frequent merges over long-lived stacked forks that diverge

## Ownership examples (SalesCoach-style)

| Agent | Owns |
|---|---|
| Coaching | `salescoach/src/app/(app)/{calls,roleplay,dashboard,me,assignments,scenarios,rubrics}/**`, grading/sampling libs |
| CRM | `salescoach/src/app/(app)/crm/**`, `salescoach/src/lib/crm*.ts`, channels/conversations as needed |
| ERP | `salescoach/src/app/(app)/erp/**`, `salescoach/src/lib/erp*.ts` |
| Ask / NL | `salescoach/src/app/(app)/ask/**`, `salescoach/src/components/assistant/**`, `salescoach/src/lib/assistant.ts` |

Shared (one writer at a time, or do first): `prisma/schema.prisma`, `src/app/(app)/layout.tsx`, `src/lib/session.ts`, root/`salescoach` README.

## Launch checklist

- [ ] Shared product root already exists on the base branch
- [ ] Base branch set correctly in the agent run
- [ ] Prompt includes identical repo/base/product-root + per-agent path ownership
- [ ] Prompt forbids new top-level products and README takeovers
- [ ] PR target is the shared branch
- [ ] After each merge, remaining agents refresh from that tip

## When coordinating from a unification / lead agent

If segments already diverged:
1. Merge them onto one branch (resolve conflicts; keep all segment features)
2. Make the product root the README primary signal
3. Comment on superseded PRs: single source of truth + “do not keep building here”
4. Tell humans: idle agents do not auto-wake — reopen those chats with the new base branch if needed

## Related

- Prompt templates: [references/agent-prompt-template.md](references/agent-prompt-template.md)
