-- A Stripe payout account only exists in the mode (live or test) it was created in,
-- so each user can have one of each. Existing accounts were created with the live key.

ALTER TABLE public.connected_accounts ADD COLUMN IF NOT EXISTS livemode boolean NOT NULL DEFAULT true;

ALTER TABLE public.connected_accounts DROP CONSTRAINT IF EXISTS connected_accounts_user_id_key;
ALTER TABLE public.connected_accounts
  ADD CONSTRAINT connected_accounts_user_id_livemode_key UNIQUE (user_id, livemode);
