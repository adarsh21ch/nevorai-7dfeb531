CREATE OR REPLACE FUNCTION public.get_user_monthly_views(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _month_start date := date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata'))::date;
  _month_end date := (date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata')) + interval '1 month')::date;
  _used integer;
  _daily_used integer;
  _plan_key text;
  _sub_status text;
  _plan_daily integer;
  _plan_mode text;
  _custom_daily integer;
  _selected_daily integer;
  _selected_tier_id uuid;
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
         extra_views_purchased, extra_views_expires_at, subscription_status
    INTO _custom_daily, _selected_daily, _selected_tier_id, _extra, _extra_expires, _sub_status
    FROM public.profiles WHERE id = _user_id;

  SELECT plan_key INTO _plan_key
    FROM public.user_subscriptions
   WHERE user_id = _user_id AND status = 'active'
   ORDER BY created_at DESC LIMIT 1;
  IF _plan_key IS NULL THEN _plan_key := 'free'; END IF;

  -- Trial users get the Pro plan_config (mirrors usePlanLimits).
  IF _sub_status = 'trial' AND _plan_key = 'free' THEN
    _plan_key := 'pro';
  END IF;

  -- Normalize plan_key variants (e.g. 'pro_monthly' -> 'pro') to plan_config names.
  IF _plan_key LIKE 'pro%'        THEN _plan_key := 'pro';
  ELSIF _plan_key LIKE 'basic%'   THEN _plan_key := 'basic';
  ELSIF _plan_key LIKE 'enterprise%' THEN _plan_key := 'enterprise';
  END IF;

  SELECT daily_view_limit, view_limit_mode
    INTO _plan_daily, _plan_mode
    FROM public.plan_config WHERE plan_name = _plan_key;

  -- Effective daily: admin override > user-selected tier > plan default.
  -- (No more popular-tier short-circuit — that caused monthly to drift away
  -- from the daily limit shown to the user.)
  IF _custom_daily IS NOT NULL THEN
    _eff_daily := _custom_daily;
  ELSIF _selected_daily IS NOT NULL THEN
    _eff_daily := _selected_daily;
  ELSE
    _eff_daily := COALESCE(_plan_daily, 20);
  END IF;

  -- Monthly is ALWAYS daily × 30 (single source of truth).
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
$function$;