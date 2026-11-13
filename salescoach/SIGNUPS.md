# Signup capture architecture

## Goal

Know **who signed up**, **from where**, and **how far they got** — without relying on Clerk alone or waiting for someone to open `/dashboard`.

## Layers

```
Landing (UTM) → sc_attr cookie
       ↓
Clerk signup  → webhook user.created  → SignupEvent (signed_up)
       ↓                                 ↓
                         provision Org+User → SignupEvent (provisioned)
       ↓
First app hit → SignupEvent (activated)
       ↓
Stripe (Phase 1) → SignupEvent (converted)
```

| Layer | System | Role |
|---|---|---|
| Identity | **Clerk** | Auth account, email verification, sessions |
| Funnel record | **`SignupEvent`** (Postgres) | Immutable-ish signup timeline + UTM |
| Tenant | **`Org` + `User`** | Product workspace |
| Marketing leads | **`Lead`** | “Book a demo” form (linked by email when possible) |

## Status machine

`signed_up` → `provisioned` → `activated` → `converted` (Stripe later) / `churned`

## Key code

- `prisma/schema.prisma` → `SignupEvent`
- `src/lib/signups.ts` → record / provision / activate / list
- `src/lib/attribution.ts` → first-touch UTM cookie helpers
- `src/app/api/webhooks/clerk/route.ts` → Clerk → DB
- `src/app/admin/signups/page.tsx` + `/api/admin/signups` → operator view

## Setup (production)

1. **Clerk Dashboard → Webhooks**
   - Endpoint: `https://www.erota.io/api/webhooks/clerk`
   - Events: `user.created` (optional: `user.updated`)
   - Copy signing secret → Vercel env `CLERK_WEBHOOK_SECRET`

2. **Vercel env**
   ```
   ADMIN_EMAILS=you@yourdomain.com
   CLERK_WEBHOOK_SECRET=whsec_...
   ```

3. Redeploy. Open `/admin` while signed in as an email listed in `ADMIN_EMAILS`.

`ADMIN_EMAILS` is the platform-owner allowlist. It is compared to the email Clerk verifies for the signed-in user. It does not create a Clerk account, it does not apply to every `@erota.io` address, and a customer's workspace Admin role does not grant it. To authorize an account that already exists, sign up or sign in with that exact email first, then add it to the existing `ADMIN_EMAILS` value (comma-separated) and redeploy. The same steps are shown at `/admin/access`.

## Attribution

Marketing layout mounts `<AttributionCapture />`. First touch wins for 30 days:

`?utm_source=google&utm_medium=cpc&utm_campaign=spring` → cookie `sc_attr` → copied onto `SignupEvent` on first login (webhook may land before cookie is available; first login fills empty UTM fields).

## What this is not (yet)

- Email/Slack alert on each signup (add Resend/webhook in Phase 1 ops)
- Stripe conversion status (Phase 1 billing)
- Full CRM sync (HubSpot) — export via `/api/admin/signups` JSON for now
