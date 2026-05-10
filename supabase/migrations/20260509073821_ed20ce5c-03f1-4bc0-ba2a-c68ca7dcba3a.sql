
-- ─── plan_view_tiers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_view_tiers (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_name       text NOT NULL CHECK (plan_name IN ('basic','pro')),
  daily_views     integer NOT NULL CHECK (daily_views > 0 OR daily_views = -1),
  monthly_views   integer GENERATED ALWAYS AS (
                    CASE WHEN daily_views = -1 THEN -1 ELSE daily_views * 30 END
                  ) STORED,
  monthly_price   integer NOT NULL DEFAULT 0,
  yearly_price    integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  is_popular      boolean NOT NULL DEFAULT false,
  display_order   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_view_tiers_plan
  ON public.plan_view_tiers(plan_name, is_active, display_order);

ALTER TABLE public.plan_view_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active tiers" ON public.plan_view_tiers;
CREATE POLICY "Anyone can view active tiers"
  ON public.plan_view_tiers FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins manage view tiers" ON public.plan_view_tiers;
CREATE POLICY "Admins manage view tiers"
  ON public.plan_view_tiers FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.tg_plan_view_tiers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS plan_view_tiers_updated_at ON public.plan_view_tiers;
CREATE TRIGGER plan_view_tiers_updated_at
BEFORE UPDATE ON public.plan_view_tiers
FOR EACH ROW EXECUTE FUNCTION public.tg_plan_view_tiers_updated_at();

-- Seed defaults (no-op if already populated)
INSERT INTO public.plan_view_tiers (plan_name, daily_views, monthly_price, yearly_price, is_popular, display_order)
SELECT * FROM (VALUES
  ('basic',  20,  149,  1490, false, 1),
  ('basic',  30,  199,  1990, false, 2),
  ('basic',  50,  249,  2490, true,  3),
  ('basic',  70,  329,  3290, false, 4),
  ('basic', 100,  399,  3990, false, 5),
  ('pro',   200,  599,  5990, false, 1),
  ('pro',   500,  799,  7990, true,  2),
  ('pro',  1000, 1199, 11990, false, 3),
  ('pro',  2000, 1799, 17990, false, 4)
) AS v(plan_name, daily_views, monthly_price, yearly_price, is_popular, display_order)
WHERE NOT EXISTS (SELECT 1 FROM public.plan_view_tiers);

-- ─── profiles: selected tier ──────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS selected_tier_id uuid REFERENCES public.plan_view_tiers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selected_daily_views integer;

-- ─── view-limit RPC: monthly = daily × 30 (single source of truth) ─
CREATE OR REPLACE FUNCTION public.get_user_monthly_views(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _month_start date := date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata'))::date;
  _month_end date := (date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata')) + interval '1 month')::date;
  _used integer;
  _daily_used integer;
  _plan_key text;
  _plan_daily integer;
  _plan_mode text;
  _custom_daily integer;
  _selected_daily integer;
  _selected_tier_id uuid;
  _popular_daily integer;
  _extra integer;
  _extra_expires timestamptz;
  _eff_daily integer;
  _eff_monthly integer;
BEGIN
  SELECT COALESCE(SUM(total_views), 0) INTO _used
    FROM public.user_daily_views
   WHERE user_id = _user_id
     AND view_date >= _month_start
     AND view_date <  _month_end;

  SELECT COALESCE(total_views, 0) INTO _daily_used
    FROM public.user_daily_views
   WHERE user_id = _user_id AND view_date = _today;

  SELECT custom_daily_views_limit, selected_daily_views, selected_tier_id,
         extra_views_purchased, extra_views_expires_at
    INTO _custom_daily, _selected_daily, _selected_tier_id, _extra, _extra_expires
    FROM public.profiles WHERE id = _user_id;

  SELECT plan_key INTO _plan_key
    FROM public.user_subscriptions
   WHERE user_id = _user_id AND status = 'active'
   ORDER BY created_at DESC LIMIT 1;
  IF _plan_key IS NULL THEN _plan_key := 'free'; END IF;

  SELECT daily_view_limit, view_limit_mode
    INTO _plan_daily, _plan_mode
    FROM public.plan_config WHERE plan_name = _plan_key;

  -- Resolve effective daily limit:
  -- 1. admin override (custom_daily_views_limit)
  -- 2. user-selected tier (selected_daily_views)
  -- 3. popular tier of the plan
  -- 4. plan default daily_view_limit
  -- 5. fallback 20
  IF _custom_daily IS NOT NULL THEN
    _eff_daily := _custom_daily;
  ELSIF _selected_daily IS NOT NULL THEN
    _eff_daily := _selected_daily;
  ELSE
    SELECT daily_views INTO _popular_daily
      FROM public.plan_view_tiers
     WHERE plan_name = _plan_key AND is_active = true AND is_popular = true
     ORDER BY display_order LIMIT 1;
    _eff_daily := COALESCE(_popular_daily, _plan_daily, 20);
  END IF;

  -- Monthly is always daily × 30 (single source of truth).
  IF _eff_daily = -1 THEN
    _eff_monthly := -1;
  ELSE
    _eff_monthly := _eff_daily * 30;
  END IF;

  -- Add purchased extras if not expired
  IF _eff_monthly <> -1 AND COALESCE(_extra, 0) > 0
     AND (_extra_expires IS NULL OR _extra_expires > now()) THEN
    _eff_monthly := _eff_monthly + _extra;
  ELSE
    IF _extra_expires IS NOT NULL AND _extra_expires <= now() THEN
      _extra := 0;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'used', _used,
    'limit', _eff_monthly,
    'plan_key', _plan_key,
    'reset_at', _month_end,
    'mode', COALESCE(_plan_mode, 'monthly'),
    'daily_used', COALESCE(_daily_used, 0),
    'daily_limit', _eff_daily,
    'extra_purchased', COALESCE(_extra, 0),
    'tier_id', _selected_tier_id
  );
END;
$$;

-- ─── whatsapp_settings (singleton) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_connected    boolean NOT NULL DEFAULT false,
  phone_number_id text,
  waba_id         text,
  verify_token    text,
  automations_enabled jsonb NOT NULL DEFAULT '{
    "welcome_signup": true,
    "trial_ending": true,
    "trial_expired": true,
    "plan_expiring": true,
    "plan_expired": true,
    "view_limit_80": true,
    "view_limit_100": true,
    "new_lead": false,
    "payment_failed": true
  }'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.whatsapp_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_settings);

ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage whatsapp settings" ON public.whatsapp_settings;
CREATE POLICY "Admins manage whatsapp settings"
  ON public.whatsapp_settings FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Service role manages whatsapp settings" ON public.whatsapp_settings;
CREATE POLICY "Service role manages whatsapp settings"
  ON public.whatsapp_settings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.tg_whatsapp_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS whatsapp_settings_updated_at ON public.whatsapp_settings;
CREATE TRIGGER whatsapp_settings_updated_at
BEFORE UPDATE ON public.whatsapp_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_whatsapp_settings_updated_at();

-- ─── whatsapp_logs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email      text,
  phone_number    text,
  automation_id   text,
  template_name   text,
  status          text NOT NULL DEFAULT 'pending',
  meta_message_id text,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_user
  ON public.whatsapp_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status
  ON public.whatsapp_logs(status, created_at DESC);

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read whatsapp logs" ON public.whatsapp_logs;
CREATE POLICY "Admins read whatsapp logs"
  ON public.whatsapp_logs FOR SELECT
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Service role manages whatsapp logs" ON public.whatsapp_logs;
CREATE POLICY "Service role manages whatsapp logs"
  ON public.whatsapp_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
