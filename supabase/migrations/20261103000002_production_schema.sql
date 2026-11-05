-- ============================================================
-- Production schema additions (additive only — safe for the live app)
-- ============================================================

-- ---- Missing tables used by the app ----
CREATE TABLE IF NOT EXISTS public.need_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id UUID NOT NULL REFERENCES public.needs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL DEFAULT 'Anonymous',
  user_avatar TEXT DEFAULT '',
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  parent_comment_id UUID REFERENCES public.need_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_need_comments_need ON public.need_comments(need_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_need_comments_parent ON public.need_comments(parent_comment_id);

CREATE TABLE IF NOT EXISTS public.thankyou_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id UUID REFERENCES public.needs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  need_title TEXT DEFAULT '',
  user_name TEXT DEFAULT '',
  user_avatar TEXT DEFAULT '',
  video_url TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT DEFAULT '',
  message TEXT DEFAULT '',
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_thankyou_videos_need ON public.thankyou_videos(need_id);
CREATE INDEX IF NOT EXISTS idx_thankyou_videos_user ON public.thankyou_videos(user_id);

CREATE TABLE IF NOT EXISTS public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT DEFAULT '',
  user_avatar TEXT DEFAULT '',
  need_id UUID REFERENCES public.needs(id) ON DELETE CASCADE,
  need_title TEXT DEFAULT '',
  amount NUMERIC(10,2),
  message TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON public.activity_feed(created_at DESC);

-- Readable by everyone; written only by server code (service_role bypasses RLS)
ALTER TABLE public.need_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thankyou_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read" ON public.need_comments;
DROP POLICY IF EXISTS "public read" ON public.thankyou_videos;
DROP POLICY IF EXISTS "public read" ON public.activity_feed;
CREATE POLICY "public read" ON public.need_comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.thankyou_videos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.activity_feed FOR SELECT TO anon, authenticated USING (true);

-- ---- Columns / constraints the code already relies on ----
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS spotter_tier TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS webhook_logs_event_id_key ON public.webhook_logs(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_pi_key ON public.payments(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_need_status ON public.payments(need_id, status);
CREATE INDEX IF NOT EXISTS idx_contributions_need ON public.contributions(need_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- ---- Admin check ----
CREATE OR REPLACE FUNCTION public.spotme_is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_user_id) $$;
REVOKE ALL ON FUNCTION public.spotme_is_admin(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spotme_is_admin(UUID) TO service_role;

-- ---- Apply one contribution to a need atomically (row lock, no lost updates) ----
CREATE OR REPLACE FUNCTION public.spotme_apply_contribution(
  p_need_id UUID, p_user_id UUID, p_user_name TEXT, p_user_avatar TEXT,
  p_amount NUMERIC, p_note TEXT, p_is_anonymous BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n RECORD;
BEGIN
  SELECT * INTO n FROM public.needs WHERE id = p_need_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.contributions (need_id, user_id, user_name, user_avatar, amount, note, is_anonymous)
  VALUES (p_need_id, p_user_id,
          CASE WHEN p_is_anonymous THEN 'A kind stranger' ELSE COALESCE(p_user_name, 'Anonymous') END,
          CASE WHEN p_is_anonymous THEN '' ELSE COALESCE(p_user_avatar, '') END,
          p_amount, COALESCE(p_note, ''), COALESCE(p_is_anonymous, false));

  UPDATE public.needs SET
    raised_amount = LEAST(raised_amount + p_amount, goal_amount),
    contributor_count = COALESCE(contributor_count, 0) + 1,
    status = CASE WHEN status = 'Collecting' AND raised_amount + p_amount >= goal_amount THEN 'Goal Met' ELSE status END,
    updated_at = now()
  WHERE id = p_need_id;

  IF n.user_id IS NOT NULL THEN
    UPDATE public.profiles SET total_raised = COALESCE(total_raised, 0) + p_amount WHERE id = n.user_id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.spotme_apply_contribution(UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spotme_apply_contribution(UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, BOOLEAN) TO service_role;

-- ---- Fulfil a succeeded Stripe payment exactly once ----
-- Returns true only for the caller that actually completed it, so the browser
-- confirmation and the Stripe webhook can both call it without double counting.
CREATE OR REPLACE FUNCTION public.spotme_fulfill_payment(p_payment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE p RECORD; a JSONB;
BEGIN
  UPDATE public.payments SET status = 'completed', completed_at = now()
  WHERE id = p_payment_id AND status IN ('pending', 'failed')
  RETURNING * INTO p;
  IF NOT FOUND THEN RETURN false; END IF;

  IF COALESCE(p.type, 'contribution') = 'spread' AND p.spread_allocations IS NOT NULL THEN
    FOR a IN SELECT * FROM jsonb_array_elements(
      CASE jsonb_typeof(p.spread_allocations) WHEN 'string' THEN (p.spread_allocations #>> '{}')::jsonb ELSE p.spread_allocations END)
    LOOP
      PERFORM public.spotme_apply_contribution((a->>'needId')::uuid, p.contributor_id, p.contributor_name,
        p.contributor_avatar, (a->>'amount')::numeric, 'Spread the Love', p.is_anonymous);
    END LOOP;
  ELSIF p.need_id IS NOT NULL THEN
    PERFORM public.spotme_apply_contribution(p.need_id, p.contributor_id, p.contributor_name,
      p.contributor_avatar, p.amount, p.note, p.is_anonymous);
  END IF;

  IF p.contributor_id IS NOT NULL THEN
    UPDATE public.profiles SET total_given = COALESCE(total_given, 0) + p.amount WHERE id = p.contributor_id;
  END IF;

  INSERT INTO public.receipts (payment_id, user_id, receipt_number, amount, need_title)
  VALUES (p.id, p.contributor_id, 'SM-' || upper(to_hex((extract(epoch FROM clock_timestamp()) * 1000)::bigint)) || '-' || substr(p.id::text, 1, 4),
          p.amount, p.need_title);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.spotme_fulfill_payment(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spotme_fulfill_payment(UUID) TO service_role;

-- ---- New Supabase Auth users get a profile row automatically ----
CREATE OR REPLACE FUNCTION public.spotme_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar, bio, city)
  VALUES (NEW.id,
          left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), 'SpotMe User'), 80),
          NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'avatar', ''),
          left(COALESCE(NEW.raw_user_meta_data->>'bio', ''), 500),
          left(COALESCE(NEW.raw_user_meta_data->>'city', ''), 100))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.spotme_handle_new_user();

NOTIFY pgrst, 'reload schema';
