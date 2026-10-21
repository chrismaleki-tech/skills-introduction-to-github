# Putting SalesCoach on erota.io (Wix)

## Important constraint

**Wix cannot host the SalesCoach Next.js app** (API routes, Prisma, grading pipeline).
`erota.io` DNS already points at Wix (`ns14/ns15.wixdns.net`) but currently returns **404** — domain is connected with no published site.

## Recommended setup

| Hostname | Hosts | Purpose |
|---|---|---|
| `erota.io` / `www.erota.io` | **Wix** | Marketing site (ads landing, pricing, demo form) |
| `app.erota.io` | **Vercel** (or similar) | Full SalesCoach product |

Wix CTAs (“Try the live demo”, “Open app”) link to `https://app.erota.io`.

## Steps

### 1. Log into Wix (manual — reCAPTCHA required)
Automated login is blocked by Google reCAPTCHA on `users.wix.com`.
Sign in at https://users.wix.com/signin then open the site connected to **erota.io**.

### 2. Publish a Wix marketing site on erota.io
Rebuild the SalesCoach landing (blue & white):
- Brand: **SalesCoach AI**
- Headline: Turn every sales call into coaching — graded against your playbook.
- CTAs: Book a demo → form; Try the live demo → `https://app.erota.io`
- Sections: How it works · Call grading · Role-play · Pricing **$50/mo** · Privacy
- Use product screenshots from `salescoach/public/marketing/`

### 3. Deploy the app to Vercel

**Important:** this GitHub repo root is not the Next.js app. See [`VERCEL_DEPLOY.md`](./VERCEL_DEPLOY.md).

In Vercel project settings:
- **Root Directory:** `salescoach`
- **Production Branch:** `cursor/sales-training-platform-29f3` (until merged to `main`)

Then redeploy. Add env vars: `DATABASE_URL` (required), optional `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`.

Or from CLI:

```bash
cd salescoach
npx vercel --prod
```

### 4. Attach `app.erota.io`
In Wix Domains (or your DNS host if you move DNS later), create:

```
CNAME  app  →  cname.vercel-dns.com
```

(Use the exact target Vercel shows in Project → Domains.)

### 5. Alternate: put the whole product on erota.io
If you prefer **not** to use Wix for the frontend:
1. Deploy SalesCoach to Vercel
2. In Wix, disconnect `erota.io` (or change nameservers away from Wix)
3. Point `erota.io` A/CNAME records to Vercel
4. Then `https://erota.io` serves the Next.js marketing + app directly

## Security
Rotate the Wix account password after sharing it in chat.
Do not commit credentials into the repo.
