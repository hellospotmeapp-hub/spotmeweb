-- ============================================================
-- Production lockdown. Run ONLY after the new app (Supabase Auth + `api`
-- Edge Function) is deployed: the old client reads profiles.password and
-- calls the Stripe SQL functions directly, and both stop working here.
--
-- Model: the browser may only READ public data (and its own private rows).
-- Every write goes through the `api` / `stripe-webhook` Edge Functions,
-- which use the service role and authorize each request.
-- ============================================================
BEGIN;

-- ---- 1. Remove every "Allow all access" style policy ----
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename NOT IN ('need_comments', 'thankyou_videos', 'activity_feed')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ---- 2. Browser roles can't write any table directly ----
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;

-- RLS on for every table (no policy = no access for anon/authenticated)
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ---- 3. Public read access ----
-- Needs stay hidden until an admin verifies them (posters see their own through the api)
CREATE POLICY "public read" ON public.needs FOR SELECT TO anon, authenticated USING (status <> 'Deleted' AND verification_status = 'approved');
CREATE POLICY "public read" ON public.contributions FOR SELECT TO anon, authenticated USING (true);

-- Profiles: public fields only. Email stays server-side; the password column is dropped.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS password;
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, name, avatar, bio, city, verified, trust_score, trust_level,
              total_raised, total_given, created_at, spotter_tier)
  ON public.profiles TO anon, authenticated;
CREATE POLICY "public read" ON public.profiles FOR SELECT TO anon, authenticated USING (true);

-- ---- 4. Private rows: owner can read their own ----
CREATE POLICY "own rows" ON public.notifications FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own rows" ON public.receipts FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own rows" ON public.spotters FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own rows" ON public.spotter_distributions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
-- Everything else (payments, connected_accounts, admin_users, app_secrets, webhook_logs,
-- error_logs, reports, push_subscriptions, payment_retries, rate_limits,
-- verification_requests) has no policy: server-only.

-- ---- 5. Remove the SQL Stripe layer (and the secret key embedded in it) ----
DROP FUNCTION IF EXISTS public.spotme_get_stripe_key();
DROP FUNCTION IF EXISTS public.spotme_create_payment_intent(integer, text, jsonb, text, integer);
DROP FUNCTION IF EXISTS public.spotme_get_payment_intent(text);
DROP FUNCTION IF EXISTS public.spotme_cancel_payment_intent(text);
DROP FUNCTION IF EXISTS public.spotme_create_stripe_account(text, text, text);
DROP FUNCTION IF EXISTS public.spotme_get_stripe_account(text);
DROP FUNCTION IF EXISTS public.spotme_create_account_link(text, text, text);
DROP FUNCTION IF EXISTS public.spotme_create_transfer(integer, text, text, jsonb);
DROP FUNCTION IF EXISTS public.spotme_create_subscription_session(text, text, integer, text, text, text, text);
DROP FUNCTION IF EXISTS public.spotme_retrieve_subscription_session(text);
DROP FUNCTION IF EXISTS public.spotme_cancel_spotter_subscription(text);
DROP FUNCTION IF EXISTS public.spotme_process_webhook(text, text, jsonb);
DROP FUNCTION IF EXISTS public.spotme_verify_webhook_signature(text, text, text, integer);

-- ---- 6. Storage: signed-in users write only inside their own folder ----
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "upload to own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('avatars', 'need-photos') AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "manage own files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('avatars', 'need-photos') AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "delete own files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('avatars', 'need-photos') AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
-- Buckets stay public, so existing image URLs keep working without a SELECT policy.

UPDATE storage.buckets
SET file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id IN ('avatars', 'need-photos');

COMMIT;

NOTIFY pgrst, 'reload schema';
