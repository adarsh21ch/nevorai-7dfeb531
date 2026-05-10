
-- 1. plan_config: dual-mode + top-up pricing
ALTER TABLE public.plan_config
  ADD COLUMN IF NOT EXISTS view_limit_mode text NOT NULL DEFAULT 'monthly'
    CHECK (view_limit_mode IN ('daily', 'monthly', 'both')),
  ADD COLUMN IF NOT EXISTS extra_views_price_per_unit integer NOT NULL DEFAULT 49,
  ADD COLUMN IF NOT EXISTS extra_views_unit_size integer NOT NULL DEFAULT 1000;

-- 2. profiles: per-user extra views top-up
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS extra_views_purchased integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_views_expires_at timestamptz;

-- 3. email_logs (rate-limit registry for system emails)
CREATE TABLE IF NOT EXISTS public.email_logs (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL,
  email_type  text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_type_time
  ON public.email_logs (user_id, email_type, created_at DESC);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages email logs"
  ON public.email_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4. get_user_monthly_views: add extra-views + dual-mode awareness
CREATE OR REPLACE FUNCTION public.get_user_monthly_views(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _month_start date := date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata'))::date;
  _month_end date := (date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata')) + interval '1 month')::date;
  _used integer;
  _daily_used integer;
  _plan_key text;
  _plan_monthly integer;
  _plan_daily integer;
  _plan_mode text;
  _custom_monthly integer;
  _custom_daily integer;
  _extra integer;
  _extra_expires timestamptz;
  _eff_monthly integer;
  _eff_daily integer;
BEGIN
  SELECT COALESCE(SUM(total_views), 0) INTO _used
    FROM public.user_daily_views
   WHERE user_id = _user_id
     AND view_date >= _month_start
     AND view_date <  _month_end;

  SELECT COALESCE(total_views, 0) INTO _daily_used
    FROM public.user_daily_views
   WHERE user_id = _user_id AND view_date = _today;

  SELECT custom_monthly_views_limit, custom_daily_views_limit, extra_views_purchased, extra_views_expires_at
    INTO _custom_monthly, _custom_daily, _extra, _extra_expires
    FROM public.profiles WHERE id = _user_id;

  SELECT plan_key INTO _plan_key
    FROM public.user_subscriptions
   WHERE user_id = _user_id AND status = 'active'
   ORDER BY created_at DESC LIMIT 1;
  IF _plan_key IS NULL THEN _plan_key := 'free'; END IF;

  SELECT monthly_views, daily_view_limit, view_limit_mode
    INTO _plan_monthly, _plan_daily, _plan_mode
    FROM public.plan_config WHERE plan_name = _plan_key;

  _eff_monthly := COALESCE(_custom_monthly, _plan_monthly, 2000);
  _eff_daily   := COALESCE(_custom_daily, _plan_daily, 20);

  -- Add purchased extras only if not expired
  IF _eff_monthly <> -1 AND COALESCE(_extra, 0) > 0
     AND (_extra_expires IS NULL OR _extra_expires > now()) THEN
    _eff_monthly := _eff_monthly + _extra;
  ELSE
    -- expired top-up → treat as 0 for display
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
    'extra_purchased', COALESCE(_extra, 0)
  );
END;
$$;

-- 5. is_funnel_over_monthly_limit: honor view_limit_mode
CREATE OR REPLACE FUNCTION public.is_funnel_over_monthly_limit(_funnel_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _owner_id uuid;
  _stats jsonb;
  _mode text;
  _daily_used int; _daily_limit int;
  _monthly_used int; _monthly_limit int;
  _daily_over boolean := false;
  _monthly_over boolean := false;
BEGIN
  SELECT owner_id INTO _owner_id FROM public.funnels WHERE id = _funnel_id;
  IF _owner_id IS NULL THEN RETURN false; END IF;

  _stats := public.get_user_monthly_views(_owner_id);
  _mode := COALESCE(_stats->>'mode', 'monthly');
  _daily_used   := COALESCE((_stats->>'daily_used')::int, 0);
  _daily_limit  := COALESCE((_stats->>'daily_limit')::int, -1);
  _monthly_used := COALESCE((_stats->>'used')::int, 0);
  _monthly_limit:= COALESCE((_stats->>'limit')::int, -1);

  IF _daily_limit  <> -1 AND _daily_limit  > 0 AND _daily_used  >= _daily_limit  THEN _daily_over := true;  END IF;
  IF _monthly_limit<> -1 AND _monthly_limit> 0 AND _monthly_used>= _monthly_limit THEN _monthly_over := true; END IF;

  IF _mode = 'daily'   THEN RETURN _daily_over;
  ELSIF _mode = 'monthly' THEN RETURN _monthly_over;
  ELSE RETURN _daily_over OR _monthly_over;
  END IF;
END;
$$;

-- 6. Seed sane defaults so existing rows pick up the new columns
UPDATE public.plan_config SET view_limit_mode = 'monthly' WHERE view_limit_mode IS NULL;
