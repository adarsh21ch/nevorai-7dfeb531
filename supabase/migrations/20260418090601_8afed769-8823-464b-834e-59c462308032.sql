
-- ========================================
-- PHASE 2: Nevorai Member Bridge + Plan Restructure
-- ========================================

-- 1. Add Leaders plan + daily_view_limit to plan_config
ALTER TABLE public.plan_config
  ADD COLUMN IF NOT EXISTS daily_view_limit integer NOT NULL DEFAULT 100;

-- Set sensible defaults for existing tiers
UPDATE public.plan_config SET daily_view_limit = 100 WHERE plan_name = 'free';
UPDATE public.plan_config SET daily_view_limit = 1000 WHERE plan_name IN ('basic', 'pro');

-- Insert Leaders plan if not exists
INSERT INTO public.plan_config (
  plan_name, monthly_price, yearly_price, yearly_validity_days,
  max_funnels, max_landing_pages, max_live_sessions, max_team_members,
  max_videos, max_storage_mb, multilevel_funnel_enabled, daily_view_limit,
  feature_lead_capture, feature_analytics, feature_whatsapp_automation,
  feature_video_sharing, feature_priority_support, feature_advanced_analytics,
  feature_go_live, feature_landing_pages, feature_team_analytics,
  feature_video_upload, feature_insights, feature_funnel_creation,
  is_enabled, plan_badge_text
) VALUES (
  'leaders', 4999, 49999, 365,
  -1, -1, -1, 10,
  -1, 102400, true, -1,
  true, true, true,
  true, true, true,
  true, true, true,
  true, true, true,
  true, 'Best for Teams'
) ON CONFLICT (plan_name) DO NOTHING;

-- 2. Add Member columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nevorai_member boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nevorai_member_source text,
  ADD COLUMN IF NOT EXISTS nevorai_member_granted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS nevorai_member_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS member_welcome_shown boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nevorai_member_last_checked_at timestamp with time zone;

-- 3. Nevorai member registry (cache from bridge)
CREATE TABLE IF NOT EXISTS public.nevorai_member_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  full_name text,
  is_pro boolean NOT NULL DEFAULT false,
  plan text,
  calling_app_user_id text,
  registered_at timestamp with time zone,
  last_synced_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  source text NOT NULL DEFAULT 'bridge',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS nevorai_member_registry_email_idx
  ON public.nevorai_member_registry (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS nevorai_member_registry_phone_idx
  ON public.nevorai_member_registry (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS nevorai_member_registry_expires_idx
  ON public.nevorai_member_registry (expires_at);

ALTER TABLE public.nevorai_member_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage member registry"
  ON public.nevorai_member_registry FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages member registry"
  ON public.nevorai_member_registry FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4. Funnel daily views (viewer cap counter)
CREATE TABLE IF NOT EXISTS public.funnel_daily_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id uuid NOT NULL,
  view_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (funnel_id, view_date)
);

CREATE INDEX IF NOT EXISTS funnel_daily_views_funnel_date_idx
  ON public.funnel_daily_views (funnel_id, view_date DESC);

ALTER TABLE public.funnel_daily_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own funnel daily views"
  ON public.funnel_daily_views FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.funnels f
    WHERE f.id = funnel_daily_views.funnel_id AND f.owner_id = auth.uid()
  ));

CREATE POLICY "Admins read all funnel daily views"
  ON public.funnel_daily_views FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages funnel daily views"
  ON public.funnel_daily_views FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. Member access logs (audit trail)
CREATE TABLE IF NOT EXISTS public.member_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  event_type text NOT NULL,
  source text NOT NULL DEFAULT 'bridge',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_access_logs_user_idx
  ON public.member_access_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS member_access_logs_event_idx
  ON public.member_access_logs (event_type, created_at DESC);

ALTER TABLE public.member_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all access logs"
  ON public.member_access_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own access logs"
  ON public.member_access_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages access logs"
  ON public.member_access_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 6. Member OTPs (for Get Access verification)
CREATE TABLE IF NOT EXISTS public.member_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text
);

CREATE INDEX IF NOT EXISTS member_otps_email_idx
  ON public.member_otps (lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS member_otps_expires_idx
  ON public.member_otps (expires_at);

ALTER TABLE public.member_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages member otps"
  ON public.member_otps FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 7. Atomic increment function for daily view counter
CREATE OR REPLACE FUNCTION public.increment_funnel_daily_view(_funnel_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _new_count integer;
BEGIN
  INSERT INTO public.funnel_daily_views (funnel_id, view_date, view_count)
  VALUES (_funnel_id, _today, 1)
  ON CONFLICT (funnel_id, view_date)
  DO UPDATE SET view_count = funnel_daily_views.view_count + 1, updated_at = now()
  RETURNING view_count INTO _new_count;
  RETURN _new_count;
END;
$$;

-- 8. Helper to check if a user is a current Nevorai member
CREATE OR REPLACE FUNCTION public.is_nevorai_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT nevorai_member AND nevorai_member_active FROM public.profiles WHERE id = _user_id),
    false
  );
$$;

-- 9. Add updated_at trigger to new tables that need it
DROP TRIGGER IF EXISTS update_funnel_daily_views_updated_at ON public.funnel_daily_views;
CREATE TRIGGER update_funnel_daily_views_updated_at
  BEFORE UPDATE ON public.funnel_daily_views
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Cleanup helper for expired OTPs (called by cron or manually)
CREATE OR REPLACE FUNCTION public.cleanup_expired_member_otps()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.member_otps WHERE expires_at < now() - interval '1 hour';
$$;
