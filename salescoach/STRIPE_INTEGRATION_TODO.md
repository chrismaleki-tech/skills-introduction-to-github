# Stripe Checkout Integration — Remaining Steps

Hosted Stripe Checkout (customers are redirected to a Stripe-hosted payment page) is already wired into this app. The Checkout Session call in [src/app/api/billing/checkout/route.ts](src/app/api/billing/checkout/route.ts) was updated with the parameters configured in Checkout Studio. This file is the single source of truth for what is left to do.

## Values to Replace

No placeholder values remain in code. The `mode`, `success_url`, `cancel_url`, and `line_items` parameters already use real values that are resolved at runtime:

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| mode | `subscription` | Correct for per-seat recurring billing. No change needed. |
| success_url | `${NEXT_PUBLIC_APP_URL}/billing?checkout=success` | Set `NEXT_PUBLIC_APP_URL=https://www.erota.io` in Vercel Production (already set). |
| cancel_url | `${NEXT_PUBLIC_APP_URL}/billing?checkout=canceled` | Same as above. |
| line_items[].price | `STRIPE_PRO_PRICE_ID` / `STRIPE_MAX_PRICE_ID` env vars | Create the live Pro ($55/seat/mo) and Max ($100/seat/mo) recurring prices at https://dashboard.stripe.com/prices and set both env vars in Vercel Production. These are currently unset in production. |

## Configured Parameters

These parameters were configured in Checkout Studio and are already set correctly.

**Files containing these parameters:**
- [src/app/api/billing/checkout/route.ts](src/app/api/billing/checkout/route.ts)

| Parameter | Value |
|-----------|-------|
| ui_mode | `hosted_page` (Stripe SDK 22.6.1; SDKs below 21.0.0 would use `hosted`) |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| allow_promotion_codes | `false` |
| payment_method_collection | `always` |
| submit_type | `auto` |
| integration_identifier | `hosted_web_0001` |
| origin_context | `web` |

Note: `allow_promotion_codes` was previously `true` in this codebase. Checkout Studio set it to `false`, so the promo-code field is no longer shown at checkout. Flip it back in the route if you want to run discount codes.

Parameters not managed by Checkout Studio (`customer`, `client_reference_id`, `subscription_data.metadata`, `metadata`) were kept because the Stripe webhook handler in [src/app/api/webhooks/stripe/route.ts](src/app/api/webhooks/stripe/route.ts) relies on them to map subscriptions back to organizations.

## Setup

### Environment variables (Vercel → erota-salescoach → Settings → Environment Variables → Production)

| Variable | Where to get it |
|----------|-----------------|
| `STRIPE_SECRET_KEY` | https://dashboard.stripe.com/apikeys (live `sk_live_...`). Production currently holds a test key. |
| `STRIPE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same page (live `pk_live_...`). |
| `STRIPE_PRO_PRICE_ID` | Price ID of the live Pro recurring price. |
| `STRIPE_MAX_PRICE_ID` | Price ID of the live Max recurring price. |
| `STRIPE_WEBHOOK_SECRET` | https://dashboard.stripe.com/workbench/webhooks → add endpoint `https://www.erota.io/api/webhooks/stripe` with events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Customer Portal configuration (`bpc_...`), see [STRIPE.md](STRIPE.md). |

The production config guard in `src/lib/env.ts` refuses to boot with test keys or missing price IDs when `VERCEL_ENV=production`.

Local development: copy `.env.example` to `.env.local` and fill in the test-mode equivalents. No new dependencies were added; `stripe` is already installed.

### Project structure

No new files were created other than this document. The existing flow is:

- `src/app/(app)/billing/page.tsx` — billing page with Pro/Max checkout forms.
- `src/app/api/billing/checkout/route.ts` — creates the hosted Checkout Session and redirects (303).
- `src/app/api/billing/portal/route.ts` — opens the Stripe Customer Portal.
- `src/app/api/webhooks/stripe/route.ts` — verifies signatures and syncs plan, seats, and subscription status to the `Org` record.
- `src/lib/stripe.ts`, `src/lib/plans.ts` — client, price lookup, plan definitions.

### How it works

1. An org admin submits the plan and seat count from `/billing`.
2. The checkout route finds or creates the Stripe Customer for the org, then creates a `subscription`-mode hosted Checkout Session with the configured parameters above.
3. The customer is redirected to Stripe, pays, and returns to `/billing?checkout=success`.
4. Stripe sends `checkout.session.completed` and subscription events to the webhook, which updates the org's plan, seat count, Stripe IDs, and period dates.

### Testing

Use test-mode keys and these cards (any future expiry, any CVC, any ZIP):

- `4242 4242 4242 4242` — succeeds.
- `4000 0025 0000 3155` — requires 3D Secure authentication.
- `4000 0000 0000 9995` — declined (insufficient funds).

Forward webhooks locally with `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and use the printed `whsec_...` as `STRIPE_WEBHOOK_SECRET`.

## Next steps

- Activate the Stripe account and switch Vercel Production to live keys and live price IDs (see table above).
- Enable ACH Direct Debit under Settings → Payments → Payment methods to lower fees on multi-seat orgs; no code change is needed since the session does not pin `payment_method_types`.
- Optionally add annual prices alongside the monthly ones.
- Confirm the Customer Portal configuration allows payment-method updates, invoice history, and cancel-at-period-end.
- Run an end-to-end live checkout with a real card and refund it.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
- https://docs.stripe.com/payments/checkout
