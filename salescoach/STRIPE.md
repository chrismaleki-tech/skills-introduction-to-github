# Stripe billing

Erota Sales Intelligence uses per-seat monthly subscriptions with a 14-day
app trial:

- **Pro:** $55 per seat/month
- **Max:** $100 per seat/month
- **Enterprise:** custom pricing

Stripe Checkout collects payment; Stripe Customer Portal handles cards,
invoices, plan changes, seat quantities, and cancellation.

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
STRIPE_PRO_PRICE_ID=price_...
STRIPE_MAX_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PORTAL_CONFIGURATION_ID=bpc_...
NEXT_PUBLIC_APP_URL=https://erota.io
```

## Stripe setup

1. Create product **Erota Sales Intelligence Pro** with a recurring monthly
   price of **USD $55.00 per seat**.
2. Create product **Erota Sales Intelligence Max** with a recurring monthly
   price of **USD $100.00 per seat**.
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
6. Copy the webhook signing secret and both price IDs to Vercel.

## Access rules

- New organizations get 14 days of trial access.
- `active`, valid `trialing`, and cancel-at-period-end before period expiry are entitled.
- Pro includes 180 role-play minutes and 25 call-scoring hours per seat per billing period.
- Max includes 480 role-play minutes and 100 call-scoring hours per seat per billing period.
- Usage is attributed to the rep seat and resets on Stripe's subscription period boundary.
- Expired, `past_due`, `unpaid`, and canceled organizations receive HTTP 402
  for uploads, on-demand grading, role-play, scenario generation, and webhook ingestion.
- Organization managers/admins manage billing at `/billing`.

## Local webhook testing

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

Use Stripe test card `4242 4242 4242 4242`, any future expiry, and any CVC.
