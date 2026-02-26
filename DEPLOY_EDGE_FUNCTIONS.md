# SpotMe Database Setup Guide

## No Edge Functions Needed!

SpotMe now runs **without Supabase Edge Functions**. All backend logic runs directly in the app using:
- **Direct Supabase client calls** for database CRUD operations
- **PostgreSQL RPC functions** for Stripe API calls (created via SQL Editor)

You only need to:
1. Create the database tables (paste SQL in Supabase SQL Editor)
2. Create the Stripe RPC functions (paste SQL in Supabase SQL Editor)
3. That's it — no CLI, no deployment commands!

---

## Step 1: Open Supabase SQL Editor

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: **wadkuixhehslrteepluf**
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

---

## Step 2: Create Database Tables

Paste this SQL and click **Run**:

```sql
-- ============================================
-- SpotMe Database Schema
-- Run this ONCE in Supabase SQL Editor
-- ============================================

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'SpotMe User',
  email TEXT UNIQUE,
  password TEXT,
  avatar TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  city TEXT DEFAULT '',
  verified BOOLEAN DEFAULT false,
  trust_score INTEGER DEFAULT 0,
  trust_level TEXT DEFAULT 'new',
  total_raised NUMERIC DEFAULT 0,
  total_given NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Needs
CREATE TABLE IF NOT EXISTS needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  category TEXT DEFAULT 'Other',
  goal_amount NUMERIC NOT NULL DEFAULT 0,
  raised_amount NUMERIC DEFAULT 0,
  contributor_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Collecting',
  photo TEXT DEFAULT '',
  user_name TEXT DEFAULT '',
  user_avatar TEXT DEFAULT '',
  user_city TEXT DEFAULT '',
  verification_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contributions
CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id UUID REFERENCES needs(id),
  user_id UUID REFERENCES profiles(id),
  user_name TEXT DEFAULT '',
  user_avatar TEXT DEFAULT '',
  amount NUMERIC NOT NULL,
  note TEXT DEFAULT '',
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payments (Stripe)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id UUID REFERENCES needs(id),
  contributor_id UUID REFERENCES profiles(id),
  contributor_name TEXT DEFAULT '',
  contributor_avatar TEXT DEFAULT '',
  amount NUMERIC NOT NULL,
  tip_amount NUMERIC DEFAULT 0,
  application_fee NUMERIC DEFAULT 0,
  recipient_receives NUMERIC DEFAULT 0,
  stripe_payment_intent_id TEXT,
  stripe_client_secret TEXT,
  status TEXT DEFAULT 'pending',
  mode TEXT DEFAULT 'stripe',
  destination_charge BOOLEAN DEFAULT false,
  connected_account_id TEXT,
  note TEXT DEFAULT '',
  is_anonymous BOOLEAN DEFAULT false,
  need_title TEXT DEFAULT '',
  type TEXT DEFAULT 'contribution',
  spread_allocations JSONB,
  failure_reason TEXT,
  failure_code TEXT,
  failed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Connected Accounts (Stripe Connect)
CREATE TABLE IF NOT EXISTS connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) UNIQUE,
  stripe_account_id TEXT,
  onboarding_complete BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,
  charges_enabled BOOLEAN DEFAULT false,
  details_submitted BOOLEAN DEFAULT false,
  last_webhook_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  type TEXT DEFAULT 'welcome',
  title TEXT DEFAULT '',
  message TEXT DEFAULT '',
  read BOOLEAN DEFAULT false,
  need_id UUID,
  avatar TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) UNIQUE,
  registered_at TIMESTAMPTZ DEFAULT now()
);

-- Error Logs
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT,
  message TEXT,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  user_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook Logs
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  event_id TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID,
  need_id UUID,
  user_id UUID,
  reason TEXT,
  details TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payment Retries
CREATE TABLE IF NOT EXISTS payment_retries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id),
  retry_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  attempted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rate Limits
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  action TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  endpoint TEXT UNIQUE,
  keys JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Receipts
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id),
  user_id UUID,
  receipt_number TEXT UNIQUE,
  amount NUMERIC,
  need_title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_needs_status ON needs(status);
CREATE INDEX IF NOT EXISTS idx_needs_user_id ON needs(user_id);
CREATE INDEX IF NOT EXISTS idx_needs_created_at ON needs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contributions_need_id ON contributions(need_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user_id ON contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_need_id ON payments(need_id);
CREATE INDEX IF NOT EXISTS idx_payments_contributor_id ON payments(contributor_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_pi ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_id ON connected_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_action ON rate_limits(key, action);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_retries ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow anon role full access (since we're not using edge functions)
-- In production, you'd want more restrictive policies
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'profiles', 'needs', 'contributions', 'payments', 
    'connected_accounts', 'notifications', 'admin_users',
    'error_logs', 'webhook_logs', 'reports', 'payment_retries',
    'rate_limits', 'push_subscriptions', 'receipts'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access" ON %I', tbl);
    EXECUTE format('CREATE POLICY "Allow all access" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;
```

---

## Step 3: Enable the HTTP Extension & Create Stripe Functions

In a **new SQL Editor query**, paste this SQL and click **Run**.

**IMPORTANT:** Replace `sk_test_REPLACE_ME_WITH_YOUR_STRIPE_SECRET_KEY` with your actual Stripe test secret key (the whole string on one line, no line breaks).


```sql
-- ============================================
-- Enable HTTP extension for Stripe API calls
-- ============================================
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- ============================================
-- Stripe RPC Functions
-- These are called from the app via supabase.rpc()
-- ============================================

-- Helper: Get Stripe secret key
-- REPLACE the key below with your actual sk_test_... key
CREATE OR REPLACE FUNCTION spotme_get_stripe_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'sk_test_51T3T9CFR9hrEIHkaQiSqmzfPgiM2j4
WuLaV1gZ6qCc5Fijw9n25jDlByFefk95tNn1NDa
540AFVWbTSjBouTAHrv00QNSDsJW6';
END;
$$;

-- Revoke direct access to the key function from public/anon
REVOKE ALL ON FUNCTION spotme_get_stripe_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION spotme_get_stripe_key() FROM anon;
REVOKE ALL ON FUNCTION spotme_get_stripe_key() FROM authenticated;

-- ============================================
-- Create PaymentIntent
-- The app calls this with 3 required params + 2 optional params.
-- When optional params are omitted, PostgreSQL uses the DEFAULTs.
-- ============================================
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
  response http_response;
  result JSONB;
  meta_key TEXT;
  meta_value TEXT;
BEGIN
  -- Get the Stripe key
  stripe_key := spotme_get_stripe_key();
  
  -- Build the request body
  request_body := 'amount=' || p_amount_cents || '&currency=' || p_currency || '&automatic_payment_methods[enabled]=true';
  
  -- Add metadata
  IF p_metadata IS NOT NULL AND p_metadata != '{}'::jsonb THEN
    FOR meta_key, meta_value IN SELECT * FROM jsonb_each_text(p_metadata)
    LOOP
      request_body := request_body || '&metadata[' || meta_key || ']=' || replace(replace(meta_value, '&', '%26'), '=', '%3D');
    END LOOP;
  END IF;
  
  -- Add destination charge
  IF p_destination IS NOT NULL AND p_destination != '' THEN
    request_body := request_body || '&transfer_data[destination]=' || p_destination;
  END IF;
  
  -- Add application fee
  IF p_application_fee_cents IS NOT NULL AND p_application_fee_cents > 0 THEN
    request_body := request_body || '&application_fee_amount=' || p_application_fee_cents;
  END IF;
  
  -- Make the HTTP request to Stripe
  SELECT * INTO response FROM http((
    'POST',
    'https://api.stripe.com/v1/payment_intents',
    ARRAY[http_header('Authorization', 'Bearer ' || stripe_key)],
    'application/x-www-form-urlencoded',
    request_body
  )::http_request);
  
  -- Parse the response
  result := response.content::jsonb;
  
  -- Check for Stripe errors
  IF result ? 'error' THEN
    RAISE EXCEPTION 'Stripe error: %', result->'error'->>'message';
  END IF;
  
  RETURN result;
END;
$$;

-- ============================================
-- Get PaymentIntent (verify payment status)
-- ============================================
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
  response http_response;
  result JSONB;
BEGIN
  stripe_key := spotme_get_stripe_key();
  
  SELECT * INTO response FROM http((
    'GET',
    'https://api.stripe.com/v1/payment_intents/' || p_payment_intent_id,
    ARRAY[http_header('Authorization', 'Bearer ' || stripe_key)],
    NULL,
    NULL
  )::http_request);
  
  result := response.content::jsonb;
  RETURN result;
END;
$$;

-- ============================================
-- Create Stripe Connect Express Account
-- ============================================
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
  response http_response;
  result JSONB;
BEGIN
  stripe_key := spotme_get_stripe_key();
  
  request_body := 'type=express'
    || '&email=' || p_email
    || '&metadata[user_id]=' || p_user_id
    || '&metadata[name]=' || replace(replace(p_name, '&', '%26'), '=', '%3D')
    || '&capabilities[card_payments][requested]=true'
    || '&capabilities[transfers][requested]=true';
  
  SELECT * INTO response FROM http((
    'POST',
    'https://api.stripe.com/v1/accounts',
    ARRAY[http_header('Authorization', 'Bearer ' || stripe_key)],
    'application/x-www-form-urlencoded',
    request_body
  )::http_request);
  
  result := response.content::jsonb;
  
  IF result ? 'error' THEN
    RAISE EXCEPTION 'Stripe error: %', result->'error'->>'message';
  END IF;
  
  RETURN result;
END;
$$;

-- ============================================
-- Get Stripe Account (check onboarding status)
-- ============================================
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
  response http_response;
  result JSONB;
BEGIN
  stripe_key := spotme_get_stripe_key();
  
  SELECT * INTO response FROM http((
    'GET',
    'https://api.stripe.com/v1/accounts/' || p_account_id,
    ARRAY[http_header('Authorization', 'Bearer ' || stripe_key)],
    NULL,
    NULL
  )::http_request);
  
  result := response.content::jsonb;
  RETURN result;
END;
$$;

-- ============================================
-- Create Account Link (onboarding URL)
-- ============================================
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
  response http_response;
  result JSONB;
BEGIN
  stripe_key := spotme_get_stripe_key();
  
  request_body := 'account=' || p_account_id
    || '&refresh_url=' || p_refresh_url
    || '&return_url=' || p_return_url
    || '&type=account_onboarding';
  
  SELECT * INTO response FROM http((
    'POST',
    'https://api.stripe.com/v1/account_links',
    ARRAY[http_header('Authorization', 'Bearer ' || stripe_key)],
    'application/x-www-form-urlencoded',
    request_body
  )::http_request);
  
  result := response.content::jsonb;
  
  IF result ? 'error' THEN
    RAISE EXCEPTION 'Stripe error: %', result->'error'->>'message';
  END IF;
  
  RETURN result;
END;
$$;

-- ============================================
-- Grant execute permissions to anon + authenticated roles
-- (needed for the app to call these via supabase.rpc())
-- ============================================
GRANT EXECUTE ON FUNCTION spotme_create_payment_intent(INTEGER, TEXT, JSONB, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION spotme_create_payment_intent(INTEGER, TEXT, JSONB, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION spotme_get_payment_intent(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION spotme_get_payment_intent(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION spotme_create_stripe_account(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION spotme_create_stripe_account(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION spotme_get_stripe_account(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION spotme_get_stripe_account(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION spotme_create_account_link(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION spotme_create_account_link(TEXT, TEXT, TEXT) TO authenticated;
```


---

## Step 4: Test It!

1. Open SpotMe in your browser
2. Create a Need or find an existing one
3. Click the "Spot" button and enter an amount
4. You should see the Stripe payment form load
5. Use test card: **4242 4242 4242 4242**
   - Expiry: any future date (e.g., 12/30)
   - CVC: any 3 digits (e.g., 123)
   - ZIP: any 5 digits (e.g., 10001)
6. Click "Pay"
7. You should be redirected to the success page

---

## How It Works (Technical Details)

### Before (Edge Functions - required CLI deployment):
```
App → supabase.functions.invoke('stripe-checkout') → Edge Function → Stripe API
```

### After (Direct + RPC - no deployment needed):
```
App → local API handler → supabase.from('table').select() (for CRUD)
App → local API handler → supabase.rpc('spotme_create_payment_intent') → PostgreSQL http extension → Stripe API
```

The app now intercepts all `supabase.functions.invoke()` calls and routes them to local handler functions that:
- Use direct Supabase client calls for database operations (no edge function needed)
- Use PostgreSQL RPC functions for Stripe API calls (created via SQL, no deployment needed)

### Files involved:
- `app/lib/api.ts` — Local API handlers (replaces all 4 edge functions)
- `app/lib/supabase.ts` — Intercepts function calls and routes to local handlers

---

## Troubleshooting

### "Could not find the function spotme_create_payment_intent"
You haven't run the SQL from Step 3 yet. Go to Supabase SQL Editor and run it.

### "Stripe error: Invalid API Key provided"
You forgot to replace `sk_test_YOUR_STRIPE_SECRET_KEY_HERE` in the SQL. Run this to update it:
```sql
CREATE OR REPLACE FUNCTION spotme_get_stripe_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'sk_test_YOUR_ACTUAL_KEY_HERE';
END;
$$;
```

### "relation 'needs' does not exist"
You haven't run the SQL from Step 2 yet. Go to Supabase SQL Editor and run it.

### "permission denied for table needs"
The RLS policies weren't created. Run the RLS section from Step 2 again.

### "Could not find the extension http"
The `http` extension isn't available. Run:
```sql
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
```

### Tables already exist
That's fine! The `CREATE TABLE IF NOT EXISTS` statements are safe to run multiple times.

---

## Updating Your Stripe Key

To switch from test to live mode (or update your key):

```sql
CREATE OR REPLACE FUNCTION spotme_get_stripe_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'sk_live_YOUR_LIVE_KEY_HERE';
END;
$$;
```

Also update the publishable key in `app/payment-checkout.tsx`:
```typescript
const STRIPE_PK = 'pk_live_YOUR_LIVE_KEY_HERE';
```
