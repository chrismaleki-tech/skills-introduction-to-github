# Deploy SalesCoach to Vercel (fix for the Python entrypoint error)

## Why the build failed

Vercel cloned **`main`** at the **repo root**. That root is the old Rearc Python/CDK project (`part4_infrastructure/cdk/app.py`), so Vercel tried a Python runtime.

SalesCoach lives in **`salescoach/`** on branch **`cursor/sales-training-platform-29f3`** (not on `main` yet).

## Fix in the Vercel dashboard

1. Open your Vercel project → **Settings** → **General**
2. **Root Directory** → set to:
   ```
   salescoach
   ```
   (click Edit → enter `salescoach` → Save)
3. **Settings** → **Git**
   - **Production Branch** → `cursor/sales-training-platform-29f3`
     (until PR #56 is merged into `main`)
4. Redeploy:
   - **Deployments** → latest → **Redeploy**
   - or push a new commit on that branch

Framework should detect **Next.js** automatically once the root is `salescoach`.

## Environment variables (Settings → Environment Variables)

| Name | Value | Required |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` for a quick demo, or a Postgres URL for production | Yes |
| `OPENAI_API_KEY` | your key | Optional (demo mode without it) |
| `DEEPGRAM_API_KEY` | your key | Optional (real audio transcription) |

For a real production DB, use Vercel Postgres / Neon / Supabase and set `DATABASE_URL` to that Postgres URL. Update `salescoach/prisma/schema.prisma` `provider` to `postgresql` when you switch off SQLite.

After first deploy with SQLite demo, you may still want to run seed via a one-off job; the app can boot without seed but will be empty until seeded.

## CLI alternative

```bash
cd salescoach
npx vercel --prod
```

When prompted, set the project root to the `salescoach` folder (or link an existing project that already has Root Directory = `salescoach`).

## After it deploys

- App URL will look like `https://your-project.vercel.app`
- Add domain `app.erota.io` in Vercel → Domains
- In DNS (Wix Domains), add:
  ```
  CNAME  app  →  cname.vercel-dns.com
  ```
  (use the exact target Vercel shows)

## Don’t do this

- Don’t set Root Directory to `/` or leave it blank on this repo
- Don’t deploy `main` until `salescoach/` is merged
- Don’t add a Python `pyproject.toml` entrypoint — that error is a red herring from the wrong folder
