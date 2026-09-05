# Deploy SalesCoach to Vercel

## Why `/` works but `/dashboard` fails

The marketing page (`/`) is static HTML — no database.

App routes (`/dashboard`, `/calls`, `/me`, …) need the Prisma demo DB. On Vercel the filesystem is read-only, so a bare `file:./dev.db` with no seed crashes those pages.

**Fix (already in this branch):** `npm run build` creates a seeded `prisma/demo.db`. At runtime each serverless function copies it to `/tmp/salescoach.db` and serves the demo team data.

## Project settings (required)

1. **Root Directory** = `salescoach`
2. **Production Branch** = `cursor/sales-training-platform-29f3` (until merged to `main`)
3. Framework: Next.js (auto-detected)

## Turn off Deployment Protection (or the URL looks like a Vercel login page)

If visiting the `.vercel.app` URL shows **“Log in to Vercel”** instead of SalesCoach:

1. Project → **Settings** → **Deployment Protection**
2. Set **Vercel Authentication** to **Only Preview Deployments** (or Off)
3. Save, then open the Production URL again in a private window

## Environment variables

| Name | Value | Required |
|---|---|---|
| `DATABASE_URL` | `file:./prisma/demo.db` | Recommended for the SQLite demo. Runtime remaps to `/tmp` on Vercel. |
| `OPENAI_API_KEY` | your key | Optional (demo graders work without it) |
| `DEEPGRAM_API_KEY` | your key | Optional (real audio transcription) |

You can omit `DATABASE_URL` — the app defaults to `file:./dev.db` locally and still picks up `prisma/demo.db` on Vercel via the runtime copy.

For real production data, use **Vercel Postgres / Neon / Supabase**, set `DATABASE_URL` to that URL, and change `provider` in `prisma/schema.prisma` to `postgresql`.

## After deploy

- Production URL: `https://<project>.vercel.app`
- App entry: `https://<project>.vercel.app/dashboard` (manager demo) or `/me` (rep view)
- Custom domain: add `app.erota.io` in Vercel → Domains, then CNAME `app` → `cname.vercel-dns.com` in Wix DNS

## Don’t do this

- Don’t set Root Directory blank / `/` on this monorepo
- Don’t deploy `main` until `salescoach/` is merged
- Don’t leave **Standard Protection / Vercel Authentication** on for Production if you want a public demo
