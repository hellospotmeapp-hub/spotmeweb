-- ============================================================
-- Move legacy profile logins into Supabase Auth (same id, same password).
-- Additive for the live app: the plaintext column is dropped later, in the
-- lockdown migration, after the new client is deployed.
-- ============================================================
BEGIN;

-- 1. Auth users that duplicate a profile's email under a different id and own
--    nothing (verified: 0 needs/contributions/payments/notifications/accounts).
DELETE FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.email) = lower(u.email));

-- 2. Create an auth user for every profile that has none, keeping its id and password.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token,
  is_sso_user, is_anonymous
)
SELECT '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated',
       lower(p.email), extensions.crypt(p.password, extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('name', p.name),
       COALESCE(p.created_at, now()), now(),
       '', '', '', '', '', '', '', '',
       false, false
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  AND p.email IS NOT NULL AND COALESCE(p.password, '') <> '';

-- 3. Email identity for every auth user that lacks one.
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email');

-- 4. Existing users have been signing in already: mark their emails confirmed.
UPDATE auth.users u SET email_confirmed_at = now()
WHERE u.email_confirmed_at IS NULL
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

COMMIT;
