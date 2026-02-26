-- ============================================================
-- SPOTME — COMPLETE STRIPE SQL SETUP
-- ============================================================
-- Paste this ENTIRE script into Supabase SQL Editor → Run
--
-- BEFORE RUNNING:
--   Replace the placeholder key on line ~40 with your real
--   Stripe SECRET key (sk_test_... or sk_live_...).
--
-- This script is SAFE to run multiple times (uses CREATE OR REPLACE).
-- ============================================================


-- ============================================================
-- 1. ENABLE THE HTTP EXTENSION
-- ============================================================
-- The http extension lets PostgreSQL make outbound HTTP requests
-- to the Stripe API. It MUST live in the "extensions" schema.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;


-- ============================================================
-- 2. STRIPE SECRET KEY FUNCTION
-- ============================================================
-- Stores your Stripe secret key securely inside a SECURITY DEFINER
-- function. Only the database owner can read the function body;
-- the anon/authenticated roles can only EXECUTE the wrapper
-- functions below (which call this internally).
--
-- ⚠️  REPLACE THE KEY BELOW WITH YOUR REAL STRIPE SECRET KEY  ⚠️
-- ============================================================
CREATE OR REPLACE FUNCTION spotme_get_stripe_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ╔══════════════════════════════════════════════════════╗
  -- ║  PASTE YOUR STRIPE SECRET KEY BETWEEN THE QUOTES    ║
  -- ║  Example: 'sk_test_51T3T8o2Xr21chucT...'           ║
  -- ╚══════════════════════════════════════════════════════╝
  RETURN 'sk_test_REPLACE_ME_WITH_YOUR_STRIPE_SECRET_KEY';
END;
$$;

-- Lock down direct access — only other SECURITY DEFINER functions
-- should call this. The public-facing RPC functions below are
-- SECURITY DEFINER themselves, so they CAN call it.
REVOKE ALL ON FUNCTION spotme_get_stripe_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION spotme_get_stripe_key() FROM anon;
REVOKE ALL ON FUNCTION spotme_get_stripe_key() FROM authenticated;


-- ============================================================
-- 3. CREATE PAYMENT INTENT
-- ============================================================
-- Called by the app to start a Stripe payment.
-- Returns the full Stripe PaymentIntent JSON (includes id,
-- client_secret, status, etc.).
--
-- Parameters:
--   p_amount_cents          — amount in cents (e.g. 500 = $5.00)
--   p_currency              — ISO currency code (default 'usd')
--   p_metadata              — JSONB metadata attached to the PI
--   p_destination           — Stripe Connect destination account ID
--                             (NULL for platform-only charges)
--   p_application_fee_cents — platform fee in cents for Connect
--                             destination charges (NULL if none)
-- ============================================================
CREATE OR REPLACE FUNCTION spotme_create_payment_intent(
  p_amount_cents INTEGER,
  p_currency TEXT DEFAULT 'usd',
  p_metadata JSONB DEFAULT '{}',
  p_destination TEXT DEFAULT NULL,
  p_application_fee_cents INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  stripe_key TEXT;
  request_body TEXT;
  response extensions.http_response;
  result JSONB;
  meta_key TEXT;
  meta_value TEXT;
BEGIN
  -- Get the Stripe secret key
  stripe_key := spotme_get_stripe_key();

  -- Validate
  IF stripe_key IS NULL OR stripe_key = '' OR stripe_key LIKE '%REPLACE_ME%' THEN
    RAISE EXCEPTION 'Stripe secret key not configured. Update spotme_get_stripe_key() with your real sk_test_... key.';
  END IF;

  IF p_amount_cents < 50 THEN
    RAISE EXCEPTION 'Amount must be at least 50 cents ($0.50).';
  END IF;

  -- Build form-encoded request body
  request_body := 'amount=' || p_amount_cents
               || '&currency=' || p_currency
               || '&automatic_payment_methods[enabled]=true';

  -- Append metadata key-value pairs
  IF p_metadata IS NOT NULL AND p_metadata != '{}'::jsonb THEN
    FOR meta_key, meta_value IN SELECT * FROM jsonb_each_text(p_metadata)
    LOOP
      request_body := request_body
        || '&metadata[' || meta_key || ']='
        || replace(replace(replace(meta_value, '%', '%25'), '&', '%26'), '=', '%3D');
    END LOOP;
  END IF;

  -- Destination charge (Stripe Connect)
  IF p_destination IS NOT NULL AND p_destination != '' THEN
    request_body := request_body
      || '&transfer_data[destination]=' || p_destination;
  END IF;

  -- Application fee (platform tip on Connect charges)
  IF p_application_fee_cents IS NOT NULL AND p_application_fee_cents > 0 THEN
    request_body := request_body
      || '&application_fee_amount=' || p_application_fee_cents;
  END IF;

  -- POST to Stripe
  SELECT * INTO response FROM extensions.http((
    'POST',
    'https://api.stripe.com/v1/payment_intents',
    ARRAY[extensions.http_header('Authorization', 'Bearer ' || stripe_key)],
    'application/x-www-form-urlencoded',
    request_body
  )::extensions.http_request);

  -- Parse response
  BEGIN
    result := response.content::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to parse Stripe response: %', response.content;
  END;

  -- Check for Stripe-level errors
  IF result ? 'error' THEN
    RAISE EXCEPTION 'Stripe API error: % (type: %, code: %)',
      result->'error'->>'message',
      result->'error'->>'type',
      COALESCE(result->'error'->>'code', 'none');
  END IF;

  RETURN result;
END;
$$;


-- ============================================================
-- 4. GET PAYMENT INTENT (verify payment status)
-- ============================================================
-- Called after the user completes (or abandons) the Stripe
-- payment form. Returns the full PaymentIntent object so the
-- app can check .status (succeeded, requires_payment_method, etc.)
-- ============================================================
CREATE OR REPLACE FUNCTION spotme_get_payment_intent(
  p_payment_intent_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  stripe_key TEXT;
  response extensions.http_response;
  result JSONB;
BEGIN
  stripe_key := spotme_get_stripe_key();

  IF p_payment_intent_id IS NULL OR p_payment_intent_id = '' THEN
    RAISE EXCEPTION 'payment_intent_id is required';
  END IF;

  SELECT * INTO response FROM extensions.http((
    'GET',
    'https://api.stripe.com/v1/payment_intents/' || p_payment_intent_id,
    ARRAY[extensions.http_header('Authorization', 'Bearer ' || stripe_key)],
    NULL,
    NULL
  )::extensions.http_request);

  BEGIN
    result := response.content::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to parse Stripe response: %', response.content;
  END;

  RETURN result;
END;
$$;


-- ============================================================
-- 5. CANCEL PAYMENT INTENT
-- ============================================================
-- Used by the setup checker to clean up test PaymentIntents,
-- and can be called if a user cancels before completing payment.
-- ============================================================
CREATE OR REPLACE FUNCTION spotme_cancel_payment_intent(
  p_payment_intent_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  stripe_key TEXT;
  response extensions.http_response;
  result JSONB;
BEGIN
  stripe_key := spotme_get_stripe_key();

  IF p_payment_intent_id IS NULL OR p_payment_intent_id = '' THEN
    RAISE EXCEPTION 'payment_intent_id is required';
  END IF;

  SELECT * INTO response FROM extensions.http((
    'POST',
    'https://api.stripe.com/v1/payment_intents/' || p_payment_intent_id || '/cancel',
    ARRAY[extensions.http_header('Authorization', 'Bearer ' || stripe_key)],
    'application/x-www-form-urlencoded',
    ''
  )::extensions.http_request);

  BEGIN
    result := response.content::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to parse Stripe response: %', response.content;
  END;

  RETURN result;
END;
$$;


-- ============================================================
-- 6. CREATE STRIPE CONNECT EXPRESS ACCOUNT
-- ============================================================
-- Creates a Stripe Express connected account for a recipient
-- so they can receive direct payouts.
-- ============================================================
CREATE OR REPLACE FUNCTION spotme_create_stripe_account(
  p_email TEXT DEFAULT '',
  p_user_id TEXT DEFAULT '',
  p_name TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  stripe_key TEXT;
  request_body TEXT;
  response extensions.http_response;
  result JSONB;
BEGIN
  stripe_key := spotme_get_stripe_key();

  IF stripe_key IS NULL OR stripe_key = '' OR stripe_key LIKE '%REPLACE_ME%' THEN
    RAISE EXCEPTION 'Stripe secret key not configured.';
  END IF;

  request_body := 'type=express'
    || '&email=' || replace(replace(p_email, '&', '%26'), '=', '%3D')
    || '&metadata[user_id]=' || replace(replace(p_user_id, '&', '%26'), '=', '%3D')
    || '&metadata[name]=' || replace(replace(p_name, '&', '%26'), '=', '%3D')
    || '&capabilities[card_payments][requested]=true'
    || '&capabilities[transfers][requested]=true';

  SELECT * INTO response FROM extensions.http((
    'POST',
    'https://api.stripe.com/v1/accounts',
    ARRAY[extensions.http_header('Authorization', 'Bearer ' || stripe_key)],
    'application/x-www-form-urlencoded',
    request_body
  )::extensions.http_request);

  BEGIN
    result := response.content::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to parse Stripe response: %', response.content;
  END;

  IF result ? 'error' THEN
    RAISE EXCEPTION 'Stripe API error: %', result->'error'->>'message';
  END IF;

  RETURN result;
END;
$$;


-- ============================================================
-- 7. GET STRIPE ACCOUNT (check onboarding status)
-- ============================================================
CREATE OR REPLACE FUNCTION spotme_get_stripe_account(
  p_account_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  stripe_key TEXT;
  response extensions.http_response;
  result JSONB;
BEGIN
  stripe_key := spotme_get_stripe_key();

  IF p_account_id IS NULL OR p_account_id = '' THEN
    RAISE EXCEPTION 'account_id is required';
  END IF;

  SELECT * INTO response FROM extensions.http((
    'GET',
    'https://api.stripe.com/v1/accounts/' || p_account_id,
    ARRAY[extensions.http_header('Authorization', 'Bearer ' || stripe_key)],
    NULL,
    NULL
  )::extensions.http_request);

  BEGIN
    result := response.content::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to parse Stripe response: %', response.content;
  END;

  RETURN result;
END;
$$;


-- ============================================================
-- 8. CREATE ACCOUNT LINK (Stripe Connect onboarding URL)
-- ============================================================
CREATE OR REPLACE FUNCTION spotme_create_account_link(
  p_account_id TEXT,
  p_return_url TEXT DEFAULT 'https://spotme.app/settings',
  p_refresh_url TEXT DEFAULT 'https://spotme.app/settings'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  stripe_key TEXT;
  request_body TEXT;
  response extensions.http_response;
  result JSONB;
BEGIN
  stripe_key := spotme_get_stripe_key();

  IF p_account_id IS NULL OR p_account_id = '' THEN
    RAISE EXCEPTION 'account_id is required';
  END IF;

  request_body := 'account=' || p_account_id
    || '&refresh_url=' || replace(replace(p_refresh_url, '&', '%26'), '=', '%3D')
    || '&return_url=' || replace(replace(p_return_url, '&', '%26'), '=', '%3D')
    || '&type=account_onboarding';

  SELECT * INTO response FROM extensions.http((
    'POST',
    'https://api.stripe.com/v1/account_links',
    ARRAY[extensions.http_header('Authorization', 'Bearer ' || stripe_key)],
    'application/x-www-form-urlencoded',
    request_body
  )::extensions.http_request);

  BEGIN
    result := response.content::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to parse Stripe response: %', response.content;
  END;

  IF result ? 'error' THEN
    RAISE EXCEPTION 'Stripe API error: %', result->'error'->>'message';
  END IF;

  RETURN result;
END;
$$;


-- ============================================================
-- 9. STRIPE WEBHOOK PROCESSOR
-- ============================================================
-- Call this from a Supabase Edge Function (or external webhook
-- endpoint) to process incoming Stripe events.
--
-- It handles:
--   payment_intent.succeeded    → mark payment completed, update need
--   payment_intent.payment_failed → mark payment failed
--   account.updated             → update connected account status
--
-- Idempotent: checks webhook_logs to skip already-processed events.
-- ============================================================
CREATE OR REPLACE FUNCTION spotme_process_webhook(
  p_event_type TEXT,
  p_event_id TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pi_id TEXT;
  v_payment RECORD;
  v_need RECORD;
  v_amount NUMERIC;
  v_new_raised NUMERIC;
  v_account_id TEXT;
  v_already_processed BOOLEAN;
BEGIN
  -- ── Idempotency check ──
  SELECT EXISTS(
    SELECT 1 FROM webhook_logs
    WHERE event_id = p_event_id AND processed = true
  ) INTO v_already_processed;

  IF v_already_processed THEN
    RETURN jsonb_build_object('status', 'already_processed', 'event_id', p_event_id);
  END IF;

  -- ── Log the event ──
  INSERT INTO webhook_logs (event_type, event_id, payload, processed)
  VALUES (p_event_type, p_event_id, p_payload, false);

  -- ════════════════════════════════════════════════════
  -- PAYMENT INTENT SUCCEEDED
  -- ════════════════════════════════════════════════════
  IF p_event_type = 'payment_intent.succeeded' THEN
    v_pi_id := p_payload->'data'->'object'->>'id';

    IF v_pi_id IS NULL THEN
      UPDATE webhook_logs SET error = 'Missing payment_intent id', processed = false
      WHERE event_id = p_event_id;
      RETURN jsonb_build_object('status', 'error', 'message', 'Missing payment_intent id');
    END IF;

    -- Find the payment record
    SELECT * INTO v_payment FROM payments
    WHERE stripe_payment_intent_id = v_pi_id
    LIMIT 1;

    IF v_payment IS NULL THEN
      UPDATE webhook_logs SET error = 'Payment record not found for PI: ' || v_pi_id, processed = false
      WHERE event_id = p_event_id;
      RETURN jsonb_build_object('status', 'error', 'message', 'Payment not found');
    END IF;

    -- Skip if already completed
    IF v_payment.status = 'completed' THEN
      UPDATE webhook_logs SET processed = true WHERE event_id = p_event_id;
      RETURN jsonb_build_object('status', 'already_completed', 'payment_id', v_payment.id);
    END IF;

    -- Mark payment as completed
    UPDATE payments SET
      status = 'completed',
      completed_at = now()
    WHERE id = v_payment.id;

    -- Record the contribution
    v_amount := v_payment.amount;

    IF v_payment.type = 'contribution' AND v_payment.need_id IS NOT NULL THEN
      INSERT INTO contributions (need_id, user_id, user_name, user_avatar, amount, note, is_anonymous)
      VALUES (
        v_payment.need_id,
        v_payment.contributor_id,
        COALESCE(v_payment.contributor_name, 'Anonymous'),
        COALESCE(v_payment.contributor_avatar, ''),
        v_amount,
        COALESCE(v_payment.note, ''),
        COALESCE(v_payment.is_anonymous, false)
      );

      -- Update the need
      SELECT * INTO v_need FROM needs WHERE id = v_payment.need_id;
      IF v_need IS NOT NULL THEN
        v_new_raised := LEAST(v_need.raised_amount + v_amount, v_need.goal_amount);
        UPDATE needs SET
          raised_amount = v_new_raised,
          contributor_count = COALESCE(contributor_count, 0) + 1,
          status = CASE WHEN v_new_raised >= goal_amount THEN 'Goal Met' ELSE status END
        WHERE id = v_payment.need_id;
      END IF;

      -- Notify the need owner
      IF v_need IS NOT NULL AND v_need.user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, message, need_id, avatar)
        VALUES (
          v_need.user_id,
          'contribution',
          'New Spot!',
          COALESCE(v_payment.contributor_name, 'Someone') || ' spotted $' || v_amount || ' on "' || COALESCE(v_need.title, '') || '"',
          v_payment.need_id,
          CASE WHEN v_payment.is_anonymous THEN '' ELSE COALESCE(v_payment.contributor_avatar, '') END
        );
      END IF;
    END IF;

    -- Update contributor's total_given
    IF v_payment.contributor_id IS NOT NULL THEN
      UPDATE profiles SET
        total_given = COALESCE(total_given, 0) + v_amount
      WHERE id = v_payment.contributor_id;
    END IF;

    -- Create receipt
    INSERT INTO receipts (payment_id, user_id, receipt_number, amount, need_title)
    VALUES (
      v_payment.id,
      v_payment.contributor_id,
      'SM-' || upper(to_hex(extract(epoch from now())::bigint)),
      v_amount,
      v_payment.need_title
    );

    -- Mark webhook as processed
    UPDATE webhook_logs SET processed = true WHERE event_id = p_event_id;

    RETURN jsonb_build_object(
      'status', 'success',
      'payment_id', v_payment.id,
      'amount', v_amount,
      'need_id', v_payment.need_id
    );
  END IF;

  -- ════════════════════════════════════════════════════
  -- PAYMENT INTENT FAILED
  -- ════════════════════════════════════════════════════
  IF p_event_type = 'payment_intent.payment_failed' THEN
    v_pi_id := p_payload->'data'->'object'->>'id';

    IF v_pi_id IS NOT NULL THEN
      UPDATE payments SET
        status = 'failed',
        failure_reason = COALESCE(
          p_payload->'data'->'object'->'last_payment_error'->>'message',
          'Payment failed'
        ),
        failure_code = COALESCE(
          p_payload->'data'->'object'->'last_payment_error'->>'code',
          'unknown'
        ),
        failed_at = now()
      WHERE stripe_payment_intent_id = v_pi_id
        AND status != 'completed';
    END IF;

    UPDATE webhook_logs SET processed = true WHERE event_id = p_event_id;
    RETURN jsonb_build_object('status', 'success', 'action', 'payment_failed');
  END IF;

  -- ════════════════════════════════════════════════════
  -- ACCOUNT UPDATED (Stripe Connect)
  -- ════════════════════════════════════════════════════
  IF p_event_type = 'account.updated' THEN
    v_account_id := p_payload->'data'->'object'->>'id';

    IF v_account_id IS NOT NULL THEN
      UPDATE connected_accounts SET
        payouts_enabled  = COALESCE((p_payload->'data'->'object'->>'payouts_enabled')::boolean, payouts_enabled),
        charges_enabled  = COALESCE((p_payload->'data'->'object'->>'charges_enabled')::boolean, charges_enabled),
        details_submitted = COALESCE((p_payload->'data'->'object'->>'details_submitted')::boolean, details_submitted),
        onboarding_complete = CASE
          WHEN (p_payload->'data'->'object'->>'details_submitted')::boolean = true
           AND (p_payload->'data'->'object'->>'charges_enabled')::boolean = true
          THEN true
          ELSE onboarding_complete
        END,
        last_webhook_at = now()
      WHERE stripe_account_id = v_account_id;
    END IF;

    UPDATE webhook_logs SET processed = true WHERE event_id = p_event_id;
    RETURN jsonb_build_object('status', 'success', 'action', 'account_updated');
  END IF;

  -- ════════════════════════════════════════════════════
  -- CHARGE REFUNDED
  -- ════════════════════════════════════════════════════
  IF p_event_type = 'charge.refunded' THEN
    v_pi_id := p_payload->'data'->'object'->>'payment_intent';

    IF v_pi_id IS NOT NULL THEN
      UPDATE payments SET
        status = 'refunded'
      WHERE stripe_payment_intent_id = v_pi_id;
    END IF;

    UPDATE webhook_logs SET processed = true WHERE event_id = p_event_id;
    RETURN jsonb_build_object('status', 'success', 'action', 'charge_refunded');
  END IF;

  -- ════════════════════════════════════════════════════
  -- UNHANDLED EVENT TYPE — log but don't error
  -- ════════════════════════════════════════════════════
  UPDATE webhook_logs SET processed = true WHERE event_id = p_event_id;
  RETURN jsonb_build_object('status', 'ignored', 'event_type', p_event_type);

END;
$$;


-- ============================================================
-- 10. STRIPE WEBHOOK SIGNATURE VERIFIER (optional helper)
-- ============================================================
-- If you want to verify Stripe webhook signatures in SQL.
-- Requires pgcrypto extension.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION spotme_verify_webhook_signature(
  p_payload TEXT,
  p_signature_header TEXT,
  p_webhook_secret TEXT,
  p_tolerance_seconds INTEGER DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_timestamp TEXT;
  v_signature TEXT;
  v_expected_sig TEXT;
  v_signed_payload TEXT;
  v_parts TEXT[];
  v_pair TEXT;
  v_ts_num BIGINT;
BEGIN
  -- Parse the Stripe-Signature header
  -- Format: t=TIMESTAMP,v1=SIGNATURE
  v_timestamp := NULL;
  v_signature := NULL;

  FOREACH v_pair IN ARRAY string_to_array(p_signature_header, ',')
  LOOP
    v_parts := string_to_array(trim(v_pair), '=');
    IF array_length(v_parts, 1) >= 2 THEN
      IF v_parts[1] = 't' THEN
        v_timestamp := v_parts[2];
      ELSIF v_parts[1] = 'v1' THEN
        v_signature := v_parts[2];
      END IF;
    END IF;
  END LOOP;

  IF v_timestamp IS NULL OR v_signature IS NULL THEN
    RETURN false;
  END IF;

  -- Check timestamp tolerance
  v_ts_num := v_timestamp::bigint;
  IF abs(extract(epoch from now()) - v_ts_num) > p_tolerance_seconds THEN
    RETURN false;
  END IF;

  -- Compute expected signature
  v_signed_payload := v_timestamp || '.' || p_payload;
  v_expected_sig := encode(
    extensions.hmac(v_signed_payload::bytea, p_webhook_secret::bytea, 'sha256'),
    'hex'
  );

  RETURN v_expected_sig = v_signature;
END;
$$;


-- ============================================================
-- 11. GRANT EXECUTE PERMISSIONS
-- ============================================================
-- The Supabase JS client connects as the "anon" role.
-- These GRANTs allow supabase.rpc('function_name', ...) to work.
-- ============================================================

-- Payment Intent functions
GRANT EXECUTE ON FUNCTION spotme_create_payment_intent(INTEGER, TEXT, JSONB, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION spotme_create_payment_intent(INTEGER, TEXT, JSONB, TEXT, INTEGER) TO authenticated;

GRANT EXECUTE ON FUNCTION spotme_get_payment_intent(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION spotme_get_payment_intent(TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION spotme_cancel_payment_intent(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION spotme_cancel_payment_intent(TEXT) TO authenticated;

-- Stripe Connect functions
GRANT EXECUTE ON FUNCTION spotme_create_stripe_account(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION spotme_create_stripe_account(TEXT, TEXT, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION spotme_get_stripe_account(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION spotme_get_stripe_account(TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION spotme_create_account_link(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION spotme_create_account_link(TEXT, TEXT, TEXT) TO authenticated;

-- Webhook processor
GRANT EXECUTE ON FUNCTION spotme_process_webhook(TEXT, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION spotme_process_webhook(TEXT, TEXT, JSONB) TO authenticated;

-- Webhook signature verifier
GRANT EXECUTE ON FUNCTION spotme_verify_webhook_signature(TEXT, TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION spotme_verify_webhook_signature(TEXT, TEXT, TEXT, INTEGER) TO authenticated;


-- ============================================================
-- 12. VERIFY INSTALLATION
-- ============================================================
-- Run this SELECT to confirm all functions were created:
-- ============================================================
DO $$
DECLARE
  fn_name TEXT;
  fn_count INTEGER := 0;
  fn_list TEXT[] := ARRAY[
    'spotme_get_stripe_key',
    'spotme_create_payment_intent',
    'spotme_get_payment_intent',
    'spotme_cancel_payment_intent',
    'spotme_create_stripe_account',
    'spotme_get_stripe_account',
    'spotme_create_account_link',
    'spotme_process_webhook',
    'spotme_verify_webhook_signature'
  ];
BEGIN
  FOREACH fn_name IN ARRAY fn_list
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = fn_name
    ) THEN
      fn_count := fn_count + 1;
      RAISE NOTICE '  ✓ % — installed', fn_name;
    ELSE
      RAISE WARNING '  ✗ % — MISSING', fn_name;
    END IF;
  END LOOP;

  IF fn_count = array_length(fn_list, 1) THEN
    RAISE NOTICE '';
    RAISE NOTICE '══════════════════════════════════════════';
    RAISE NOTICE '  ALL % FUNCTIONS INSTALLED SUCCESSFULLY', fn_count;
    RAISE NOTICE '══════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '  Next step: Replace the Stripe key in';
    RAISE NOTICE '  spotme_get_stripe_key() with your real';
    RAISE NOTICE '  sk_test_... key, then re-run this script.';
  ELSE
    RAISE WARNING '';
    RAISE WARNING '  SOME FUNCTIONS FAILED TO INSTALL';
    RAISE WARNING '  Installed: %/% — check errors above', fn_count, array_length(fn_list, 1);
  END IF;
END $$;
