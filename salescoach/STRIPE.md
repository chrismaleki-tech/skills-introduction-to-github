# Stripe billing

SalesCoach uses a flat **$50/month per organization** subscription with a
14-day app trial. Stripe Checkout collects payment; Stripe Customer Portal
handles cards, invoices, and cancellation.

## Architecture

```
/billing → POST /api/billing/checkout → Stripe Checkout
                                              ↓
                            POST /api/webhooks/stripe
                                              ↓
        Org.planStatus / subscription dates / Stripe IDs
                                              ↓
                     SignupEvent.status = converted
```

Webhook deliveries are deduplicated in `BillingEvent` by Stripe event ID.

## Required environment variables

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://erota.io
```

## Stripe setup

1. Create product **SalesCoach Individual**.
2. Create a recurring monthly price: **USD $50.00**.
3. Enable Customer Portal:
   - update payment method
   - view invoices
   - cancel subscription at period end
4. Add webhook endpoint:
   `https://erota.io/api/webhooks/stripe`
5. Subscribe to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
6. Copy the webhook signing secret and price ID to Vercel.

## Access rules

- New organizations get 14 days of trial access.
- `active`, valid `trialing`, and cancel-at-period-end before period expiry are entitled.
- Expired, `past_due`, `unpaid`, and canceled organizations receive HTTP 402
  for uploads, on-demand grading, role-play, scenario generation, and webhook ingestion.
- Organization managers/admins manage billing at `/billing`.

## Local webhook testing

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

Use Stripe test card `4242 4242 4242 4242`, any future expiry, and any CVC.
