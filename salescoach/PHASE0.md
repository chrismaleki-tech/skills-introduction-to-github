# Phase 0 — Foundations setup

Goal: Postgres + Clerk auth + org auto-provision + durable audio storage + protected app routes.

## 1. PostgreSQL

**Local (Docker):**

```bash
cd salescoach
docker compose up -d
# DATABASE_URL=postgresql://salescoach:salescoach@127.0.0.1:5432/salescoach
npm run db:push
npm run db:seed   # optional Meridian demo tenant for local demo-auth
```

**Production:** create a Neon / Supabase / Vercel Postgres database and set `DATABASE_URL` in Vercel.

Build runs `prisma db push` (see `vercel.json`). Prefer `prisma migrate` once the schema stabilizes.

## 2. Clerk (required for real signup)

1. Create an application at [clerk.com](https://clerk.com)
2. Add paths `/sign-in` and `/sign-up`
3. Set in Vercel + `.env`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

4. Add your production domain in Clerk → Domains

Without these keys the app stays in **demo auth** (cookie user switcher + seeded Meridian).

On first Clerk sign-in/sign-up, SalesCoach auto-creates:
- an `Org` (slug + trial plan status)
- an `ADMIN` user linked via `clerkId`
- empty company profile
- a cloned Discovery rubric as the active methodology

## 3. Object storage (S3 or Cloudflare R2)

Set:

```
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_REGION=auto
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com   # R2 only
```

Audio refs are stored as `s3:<key>` (or `local:uploads/...` when unset).

## 4. Route protection

`src/middleware.ts` protects all app + API routes when Clerk is enabled.
Public: `/`, `/privacy`, `/sign-in`, `/sign-up`, `/api/leads`, `/api/health`, ingest + vapi webhooks.

## 5. Verify

```bash
curl -s localhost:3000/api/health
# { "ok": true, "auth": "clerk"|"demo", "storage": "s3"|"local", ... }
```

Sign up → land on `/dashboard` with an empty org (managers) or `/me` after role changes in Phase 1 invites.

## Still demo until Phase 1

- No Stripe billing yet (`planStatus` is always `trialing` / seed `active`)
- No email invites
- No guided onboarding UI (org is empty but usable)
