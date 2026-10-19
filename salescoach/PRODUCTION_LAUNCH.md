# Production launch checklist

Code-level safeguards are implemented. The following steps require account
owner access and cannot be completed from repository code.

## 1. Clerk production

- Recover Wix DNS access for `erota.io`.
- Complete Clerk's production-domain DNS records.
- Replace Vercel production values with Clerk `pk_live_` / `sk_live_` keys.
- Create the production endpoint `https://erota.io/api/webhooks/clerk` for
  `user.created` and `user.updated`.
- Set its signing secret as `CLERK_WEBHOOK_SECRET`.

## 2. Stripe live billing

- In live mode, create **Erota Sales Intelligence Pro** at $55/seat/month.
- Create **Erota Sales Intelligence Max** at $100/seat/month.
- Set live-only Vercel production values:
  `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
  `STRIPE_PRO_PRICE_ID`, and `STRIPE_MAX_PRICE_ID`.
- Create `https://erota.io/api/webhooks/stripe` with the four events documented
  in `STRIPE.md`; set its live signing secret.
- Configure Customer Portal plan changes, seat quantity changes, cards,
  invoices, and cancellation.

## 3. Database isolation and schema

- Create separate Neon production and preview branches/databases.
- Scope each `DATABASE_URL` only to its matching Vercel environment.
- Apply the schema to each target before deployment:
  `DATABASE_URL="..." npm run db:push`.
- Enable Neon point-in-time restore or scheduled backups and perform a test
  restore before launch.

## 4. R2 direct uploads

- Apply the production CORS rule in `PHASE0.md`.
- Keep R2 credentials scoped to Vercel Production.
- Test a real browser upload, playback, and deletion.

## 5. Operations

- Generate independent random `OPS_SECRET` and `CRON_SECRET` values.
- Optionally connect `ALERT_WEBHOOK_URL` to an operations Slack channel.
- Rotate the Vercel token previously shared during setup.
- Run protected diagnostics:

```bash
curl -H "Authorization: Bearer $OPS_SECRET" \
  "https://erota.io/api/health?deep=1"
```

## 6. Release smoke test

1. Create a new account and confirm Clerk provisioning.
2. Complete text role-play and verify an OpenAI-generated response and grade.
3. Upload a consented audio sample; verify R2, Deepgram, grading, playback,
   usage metering, and deletion.
4. Complete live checkout with a real card, verify webhook activation, open
   Customer Portal, then refund/cancel the test transaction.
5. Confirm the retention cron returns HTTP 200 from Vercel Cron logs.
