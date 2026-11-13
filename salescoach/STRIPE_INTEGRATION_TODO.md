# Stripe Checkout Integration — Remaining Steps

Hosted Stripe Checkout (customers are redirected to a Stripe-hosted payment page) is already wired into this app. The Checkout Session call in [src/app/api/billing/checkout/route.ts](src/app/api/billing/checkout/route.ts) was updated with the parameters configured in Checkout Studio. This file is the single source of truth for what is left to do.

## Values to Replace

No placeholder values remain in code. The `mode`, `success_url`, `cancel_url`, and `line_items` parameters already use real values that are resolved at runtime:

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| mode | `subscription` | Correct for per-seat recurring billing. No change needed. |
| success_url | `${NEXT_PUBLIC_APP_URL}/billing?checkout=success` | Set `NEXT_PUBLIC_APP_URL=https://www.erota.io` in Vercel Production (already set). |
| cancel_url | `${NEXT_PUBLIC_APP_URL}/billing?checkout=canceled` | Same as above. |
| line_items[].price | `STRIPE_PRO_PRICE_ID` / `STRIPE_MAX_PRICE_ID` env vars | Live prices exist and both env vars are set in Vercel Production (Pro `price_1USTVeReLRONsYRwkHvaJDQY`, Max `price_1USTVeReLRONsYRwLlkZ10I4`). No change needed. |

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

### Live Stripe resources (account `acct_1UCuMGReLRONsYRw`, Erota.io)

| Resource | ID |
|----------|----|
| Product: Erota Sales Intelligence Pro | `prod_VTQMAoVewueN7g` |
| Price: Pro, $55/seat/month | `price_1USTVeReLRONsYRwkHvaJDQY` |
| Product: Erota Sales Intelligence Max | `prod_VTQMKq8H7VIDzZ` |
| Price: Max, $100/seat/month | `price_1USTVeReLRONsYRwLlkZ10I4` |
| Webhook endpoint `https://www.erota.io/api/webhooks/stripe` (4 subscription/checkout events) | `we_1USTVxReLRONsYRwcp8mXbDW` |
| Customer Portal configuration (payment method update, invoices, cancel at period end, Pro/Max plan and seat changes) | `bpc_1USTVxReLRONsYRwqAKuAmL3` |

An older live product `erota.io` with a $50/month price (`price_1UST65ReLRONsYRw7lqX32rT`) predates this setup and is not used by the app; archive it in the Dashboard if it is not needed.

### Environment variables (Vercel → erota-salescoach → Settings → Environment Variables)

All Production values are live-mode and set. Preview/Development keep the test-mode values.

| Variable | Production | Preview / Development |
|----------|------------|-----------------------|
| `STRIPE_SECRET_KEY` | live, sensitive | test |
| `STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | live | test |
| `STRIPE_PRO_PRICE_ID`, `STRIPE_MAX_PRICE_ID` | live price IDs above | unset (falls back to `STRIPE_PRICE_ID`) |
| `STRIPE_PRICE_ID` (legacy single-plan var used by the currently deployed production code) | live Pro price | test price |
| `STRIPE_WEBHOOK_SECRET` | live, sensitive | test |
| `STRIPE_PORTAL_CONFIGURATION_ID` | live | test |

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

- Enable ACH Direct Debit under Settings → Payments → Payment methods (currently off / not yet available on the account) to lower fees on multi-seat orgs; no code change is needed since the session does not pin `payment_method_types`.
- Optionally add annual prices alongside the monthly ones.
- The portal links to `https://www.erota.io/terms`, which only exists on the hardening branch; promote that branch or the link 404s until then.
- Run an end-to-end live checkout with a real card and refund it.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
- https://docs.stripe.com/payments/checkout
