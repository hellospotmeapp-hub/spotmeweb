-- Only server-side code (service_role) may create Stripe transfers.
REVOKE EXECUTE ON FUNCTION public.spotme_create_transfer(integer, text, text, jsonb) FROM PUBLIC, anon, authenticated;
