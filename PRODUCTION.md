# SpotMe production setup

Backend: Supabase project `wjhxrpwobnyntokegrtx`. Frontend: Expo web build on Vercel.

## Architecture

- **Auth**: Supabase Auth (email + password, email confirmation on). A trigger
  (`on_auth_user_created`) creates the `profiles` row from the signup metadata.
- **Reads**: the browser reads public data directly (`needs`, `contributions`,
  public `profiles` columns) and its own private rows (`notifications`,
  `receipts`, `spotters`) under Row Level Security.
- **Writes**: everything goes through the `api` Edge Function
  (`supabase/functions/api`). The app still calls
  `supabase.functions.invoke('<name>', { body })`; `app/lib/supabase.ts` forwards
  it to `api` with the user's session token. `api` runs with the service role and
  authorizes every action from the verified token, never from the request body.
  Admins are the users listed in `admin_users`.
- **Payments**: `api` creates Stripe PaymentIntents. A payment is completed by
  `spotme_fulfill_payment()` exactly once, whether the browser confirmation or the
  `stripe-webhook` function gets there first.
- **Payouts**: donations to recipients without a Stripe Connect account are
  collected by the platform and transferred when they finish onboarding or
  request a payout (idempotent per payment).

## Secrets

Supabase → Edge Functions → Secrets (or `supabase secrets set NAME=value`):

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` while testing, `sk_live_...` in production |
| `STRIPE_WEBHOOK_SECRET` | signing secret of the live webhook endpoint |
| `STRIPE_WEBHOOK_SECRET_2` | signing secret of the test webhook endpoint |
| `APP_ORIGINS` | optional, comma-separated allowed redirect origins (default `https://spotmeone.com,https://www.spotmeone.com`) |

Vercel → Environment Variables (see `.env.example`):

| Name | Value |
|---|---|
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` / `pk_live_...`, same mode as `STRIPE_SECRET_KEY` |

Stripe webhook endpoint (one in test mode, one in live mode):
`https://wjhxrpwobnyntokegrtx.supabase.co/functions/v1/stripe-webhook`, events
`payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`,
`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.payment_failed`.

## Deploying

```sh
supabase link --project-ref wjhxrpwobnyntokegrtx
supabase functions deploy api
supabase functions deploy stripe-webhook --no-verify-jwt
supabase db query --linked -f supabase/migrations/<file>.sql   # one migration at a time
```

## Migrations

| File | Status |
|---|---|
| `20261103000001_lock_stripe_transfer.sql` | applied 2026-11-03 |
| `20261103000002_production_schema.sql` | applied 2026-11-03 |
| `20261103000003_migrate_users_to_auth.sql` | applied 2026-11-03 |
| `20261103000004_lockdown.sql` | **run after the new frontend is live** (the old frontend depends on what it removes) |
| `20261103000005_backfill_profile_totals.sql` | applied 2026-11-03 |
| `20261104000006_need_verification.sql` | run before deploying the `api` that hides unapproved needs |
| `20261107000007_connected_accounts_mode.sql` | run before deploying the `api` that keeps live and test payout accounts apart |

## Go-live checklist

1. Stripe test mode: set `STRIPE_SECRET_KEY=sk_test_...` and the test webhook
   secret; deploy a Vercel preview with `pk_test_...`.
2. On the preview: sign in with an existing account, sign up a new one (confirm
   the email), connect a test payout account, post a need, donate with card
   `4242 4242 4242 4242`, check the need total and the webhook log, request a payout.
3. Clean up the test data (test payments, contributions and need totals).
4. Switch to live: `STRIPE_SECRET_KEY=sk_live_...`, Vercel production
   `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`, deploy production.
5. Run `20261103000004_lockdown.sql`.
6. Supabase → Authentication: enable leaked password protection; set Site URL
   and redirect URLs to the production domain (used by confirmation and
   password reset emails).
