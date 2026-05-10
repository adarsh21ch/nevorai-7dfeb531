-- Add monthly_views and max_leads_export to plan_config
ALTER TABLE public.plan_config ADD COLUMN IF NOT EXISTS monthly_views integer DEFAULT 2000;
ALTER TABLE public.plan_config ADD COLUMN IF NOT EXISTS max_leads_export integer DEFAULT 500;

-- Per-user overrides on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_monthly_views_limit integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_max_funnels integer;

-- Seed defaults for existing plans
UPDATE public.plan_config SET monthly_views = 2000,  max_leads_export = 500  WHERE plan_name = 'basic';
UPDATE public.plan_config SET monthly_views = 20000, max_leads_export = -1   WHERE plan_name = 'pro';
UPDATE public.plan_config SET monthly_views = 0,     max_leads_export = 0    WHERE plan_name = 'free';

-- RPC: get a user's monthly views used (current calendar month, IST)
CREATE OR REPLACE FUNCTION public.get_user_monthly_views(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _month_start date := date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata'))::date;
  _month_end date := (date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata')) + interval '1 month')::date;
  _used integer;
  _plan_key text;
  _plan_limit integer;
  _custom_limit integer;
  _effective integer;
BEGIN
  SELECT COALESCE(SUM(total_views), 0) INTO _used
  FROM public.user_daily_views
  WHERE user_id = _user_id
    AND view_date >= _month_start
    AND view_date < _month_end;

  SELECT custom_monthly_views_limit INTO _custom_limit FROM public.profiles WHERE id = _user_id;

  SELECT plan_key INTO _plan_key
  FROM public.user_subscriptions
  WHERE user_id = _user_id AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;
  IF _plan_key IS NULL THEN _plan_key := 'free'; END IF;

  SELECT monthly_views INTO _plan_limit FROM public.plan_config WHERE plan_name = _plan_key;
  _effective := COALESCE(_custom_limit, _plan_limit, 2000);

  RETURN jsonb_build_object(
    'used', _used,
    'limit', _effective,
    'plan_key', _plan_key,
    'reset_at', _month_end
  );
END;
$$;

-- RPC: check if a funnel owner is over their monthly limit (used by edge fn / public viewer)
CREATE OR REPLACE FUNCTION public.is_funnel_over_monthly_limit(_funnel_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _owner_id uuid;
  _stats jsonb;
BEGIN
  SELECT owner_id INTO _owner_id FROM public.funnels WHERE id = _funnel_id;
  IF _owner_id IS NULL THEN RETURN false; END IF;
  _stats := public.get_user_monthly_views(_owner_id);
  IF (_stats->>'limit')::int = -1 THEN RETURN false; END IF;
  RETURN (_stats->>'used')::int >= (_stats->>'limit')::int;
END;
$$;