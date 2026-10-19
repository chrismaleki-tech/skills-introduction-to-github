# Deploy Erota Sales Intelligence to Vercel

Application routes require PostgreSQL, Clerk, and durable R2/S3 storage.
Production startup fails when required live configuration is missing so the
site cannot silently fall back to demo authentication or ephemeral storage.

## Project settings (required)

1. **Root Directory** = `salescoach`
2. **Production Branch** = the reviewed release branch
3. Framework: Next.js (auto-detected)

## Turn off Deployment Protection (or the URL looks like a Vercel login page)

If visiting the `.vercel.app` URL shows **“Log in to Vercel”** instead of Erota Sales Intelligence:

1. Project → **Settings** → **Deployment Protection**
2. Set **Vercel Authentication** to **Only Preview Deployments** (or Off)
3. Save, then open the Production URL again in a private window

## Environment variables

| Name | Value | Required |
|---|---|---|
| `DATABASE_URL` | Postgres URL (Neon/Supabase/Vercel Postgres) | **Yes** |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Live Clerk keys | **Yes** |
| `CLERK_WEBHOOK_SECRET` | Clerk endpoint signing secret | **Yes** |
| `S3_BUCKET` + access keys + `S3_ENDPOINT` | Durable audio | **Yes** |
| `OPENAI_API_KEY` | Grading and role-play | **Yes** |
| `DEEPGRAM_API_KEY` | Audio transcription | **Yes** |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | Live Stripe keys | **Yes** |
| `STRIPE_PRO_PRICE_ID` / `STRIPE_MAX_PRICE_ID` | Live recurring prices | **Yes** |
| `STRIPE_WEBHOOK_SECRET` | Live endpoint signing secret | **Yes** |
| `OPS_SECRET` / `CRON_SECRET` | Independent random 32-byte secrets | **Yes** |
| `NEXT_PUBLIC_APP_URL` | `https://erota.io` | **Yes** |

See [`PHASE0.md`](./PHASE0.md) for full Phase 0 setup.

## Release sequence

1. Apply the reviewed Prisma schema to the target database with `npm run db:push`.
2. Deploy the reviewed commit.
3. Check `https://erota.io/api/health`.
4. Run protected diagnostics:
   `curl -H "Authorization: Bearer $OPS_SECRET" "https://erota.io/api/health?deep=1"`.
5. Complete signup, role-play, call upload, Stripe checkout, webhook, and portal smoke tests.

## Don’t do this

- Don’t set Root Directory blank / `/` on this monorepo
- Don’t scope production database or live payment keys to Preview
- Don’t run `prisma db push` automatically from a preview build
- Don’t leave **Standard Protection / Vercel Authentication** on for Production if you want a public demo
