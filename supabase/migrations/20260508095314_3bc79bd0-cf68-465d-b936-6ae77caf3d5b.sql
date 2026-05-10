
-- 1) Drop access_code_plain (migrate funnels to hash first)
ALTER TABLE public.funnels ADD COLUMN IF NOT EXISTS access_code_hash text;
UPDATE public.funnels
   SET access_code_hash = encode(digest(upper(trim(access_code_plain)), 'sha256'), 'hex')
 WHERE access_code_plain IS NOT NULL AND access_code_hash IS NULL;

ALTER TABLE public.funnels        DROP COLUMN IF EXISTS access_code_plain;
ALTER TABLE public.funnel_steps   DROP COLUMN IF EXISTS access_code_plain;
ALTER TABLE public.landing_pages  DROP COLUMN IF EXISTS access_code_plain;

-- 2) Tighten funnel_step_progress / member_activity_log public reads
DROP POLICY IF EXISTS "Anyone can view own progress"  ON public.funnel_step_progress;
DROP POLICY IF EXISTS "Anyone can view own activity"  ON public.member_activity_log;

-- Helper RPCs returning only the caller's own session rows
CREATE OR REPLACE FUNCTION public.get_session_step_progress(_funnel_id uuid, _session_id text)
RETURNS SETOF public.funnel_step_progress
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT *
  FROM public.funnel_step_progress
  WHERE funnel_id = _funnel_id
    AND session_id = _session_id
    AND _session_id IS NOT NULL
    AND length(_session_id) BETWEEN 8 AND 128;
$$;

CREATE OR REPLACE FUNCTION public.get_session_activity(_funnel_id uuid, _session_id text)
RETURNS SETOF public.member_activity_log
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT *
  FROM public.member_activity_log
  WHERE funnel_id = _funnel_id
    AND session_id = _session_id
    AND _session_id IS NOT NULL
    AND length(_session_id) BETWEEN 8 AND 128;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_step_progress(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_session_activity(uuid, text)      TO anon, authenticated;

-- Lookup helper for "did I already log activity today" (no full row exposure)
CREATE OR REPLACE FUNCTION public.has_activity_today(_funnel_id uuid, _session_id text, _activity_date date)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_activity_log
    WHERE funnel_id = _funnel_id
      AND session_id = _session_id
      AND activity_date = _activity_date
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_activity_today(uuid, text, date) TO anon, authenticated;

-- 3) Storage: enforce ownership for landing-page-assets update/delete
DROP POLICY IF EXISTS "Users can update own landing page assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own landing page assets" ON storage.objects;

CREATE POLICY "Users can update own landing page assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'landing-page-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'landing-page-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own landing page assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'landing-page-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4) platform_settings: gate public reads with an is_public whitelist
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

UPDATE public.platform_settings SET is_public = true
 WHERE key IN (
   'support_whatsapp','support_message_template',
   'razorpay_onetime_price','razorpay_monthly_price',
   'razorpay_onetime_validity_days','razorpay_onetime_is_lifetime',
   'announcement_text','announcement_active','maintenance_mode',
   'testimonial_max_video_seconds','testimonial_max_per_page','testimonial_video_feature_enabled'
 );

DROP POLICY IF EXISTS "Anyone can read settings" ON public.platform_settings;
CREATE POLICY "Public can read public settings"
ON public.platform_settings FOR SELECT
USING (is_public = true);

-- Admins still manage everything via the existing "Admins can manage settings" policy.

-- 5) Rate-limit helper for verify-funnel-code: backed by funnel_access_logs
CREATE OR REPLACE FUNCTION public.check_funnel_code_rate_limit(_funnel_id uuid, _ip text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  _max int := 5;
  _window interval := interval '15 minutes';
  _fail_count int;
BEGIN
  SELECT count(*) INTO _fail_count
  FROM public.funnel_access_logs
  WHERE funnel_id = _funnel_id
    AND COALESCE(ip_address, '') = COALESCE(_ip, '')
    AND success = false
    AND created_at > now() - _window;

  IF _fail_count >= _max THEN
    RETURN jsonb_build_object('locked', true, 'attempts', _fail_count);
  END IF;
  RETURN jsonb_build_object('locked', false, 'attempts', _fail_count, 'remaining', _max - _fail_count);
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_funnel_code_rate_limit(uuid, text) TO anon, authenticated, service_role;
