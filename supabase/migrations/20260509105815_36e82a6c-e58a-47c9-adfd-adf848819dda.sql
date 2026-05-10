-- Admin override columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_unlimited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_granted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS override_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS override_note text;

CREATE INDEX IF NOT EXISTS idx_profiles_is_unlimited ON public.profiles(is_unlimited) WHERE is_unlimited = true;

-- Update increment_user_daily_view to honor is_unlimited override (bypass all limits)
CREATE OR REPLACE FUNCTION public.increment_user_daily_view(_funnel_id uuid, _session_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _owner_id uuid;
  _plan_key text;
  _sub_status text;
  _plan_limit integer;
  _custom_limit integer;
  _selected_daily integer;
  _effective_limit integer;
  _new_total integer;
  _already_counted boolean;
  _existing_80 boolean;
  _existing_100 boolean;
  _row_id uuid;
  _is_unlimited boolean;
BEGIN
  SELECT owner_id INTO _owner_id FROM public.funnels WHERE id = _funnel_id;
  IF _owner_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'funnel_not_found');
  END IF;

  -- Session dedup (unchanged)
  IF _session_id IS NOT NULL AND _session_id <> '' THEN
    SELECT counted INTO _already_counted
    FROM public.user_view_sessions
    WHERE session_id = _session_id AND view_date = _today
    LIMIT 1;
    IF _already_counted = true THEN
      SELECT total_views INTO _new_total
      FROM public.user_daily_views
      WHERE user_id = _owner_id AND view_date = _today;
      RETURN jsonb_build_object('allowed', true, 'deduped', true, 'currentCount', COALESCE(_new_total, 0));
    END IF;
  END IF;

  SELECT custom_daily_views_limit, selected_daily_views, subscription_status, is_unlimited
    INTO _custom_limit, _selected_daily, _sub_status, _is_unlimited
    FROM public.profiles WHERE id = _owner_id;

  -- ADMIN UNLIMITED OVERRIDE: bypass all limits
  IF COALESCE(_is_unlimited, false) = true THEN
    INSERT INTO public.user_view_sessions(user_id, funnel_id, session_id, view_date, counted)
    VALUES (_owner_id, _funnel_id, COALESCE(NULLIF(_session_id, ''), gen_random_uuid()::text), _today, true)
    ON CONFLICT (session_id, view_date) DO NOTHING;

    INSERT INTO public.user_daily_views(user_id, view_date, total_views)
    VALUES (_owner_id, _today, 1)
    ON CONFLICT (user_id, view_date)
    DO UPDATE SET total_views = user_daily_views.total_views + 1, updated_at = now()
    RETURNING total_views INTO _new_total;

    RETURN jsonb_build_object('allowed', true, 'unlimited', true, 'override', true, 'currentCount', _new_total, 'limit', -1);
  END IF;

  SELECT plan_key INTO _plan_key
  FROM public.user_subscriptions
  WHERE user_id = _owner_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  IF _plan_key IS NULL THEN _plan_key := 'free'; END IF;

  IF _sub_status = 'trial' AND _plan_key = 'free' THEN
    _plan_key := 'pro';
  END IF;

  IF _plan_key LIKE 'pro%' THEN _plan_key := 'pro';
  ELSIF _plan_key LIKE 'basic%' THEN _plan_key := 'basic';
  ELSIF _plan_key LIKE 'enterprise%' THEN _plan_key := 'enterprise';
  END IF;

  SELECT daily_view_limit INTO _plan_limit
  FROM public.plan_config
  WHERE plan_name = _plan_key;

  IF _custom_limit IS NOT NULL THEN
    _effective_limit := _custom_limit;
  ELSIF _selected_daily IS NOT NULL THEN
    _effective_limit := _selected_daily;
  ELSE
    _effective_limit := COALESCE(_plan_limit, 20);
  END IF;

  IF _effective_limit = -1 THEN
    INSERT INTO public.user_view_sessions(user_id, funnel_id, session_id, view_date, counted)
    VALUES (_owner_id, _funnel_id, COALESCE(NULLIF(_session_id, ''), gen_random_uuid()::text), _today, true)
    ON CONFLICT (session_id, view_date) DO NOTHING;

    INSERT INTO public.user_daily_views(user_id, view_date, total_views)
    VALUES (_owner_id, _today, 1)
    ON CONFLICT (user_id, view_date)
    DO UPDATE SET total_views = user_daily_views.total_views + 1, updated_at = now()
    RETURNING total_views, id INTO _new_total, _row_id;

    RETURN jsonb_build_object('allowed', true, 'unlimited', true, 'currentCount', _new_total, 'limit', -1);
  END IF;

  SELECT total_views INTO _new_total
  FROM public.user_daily_views
  WHERE user_id = _owner_id AND view_date = _today;

  IF COALESCE(_new_total, 0) >= _effective_limit THEN
    RETURN jsonb_build_object('allowed', false, 'currentCount', COALESCE(_new_total, 0), 'limit', _effective_limit);
  END IF;

  INSERT INTO public.user_daily_views(user_id, view_date, total_views)
  VALUES (_owner_id, _today, 1)
  ON CONFLICT (user_id, view_date)
  DO UPDATE SET total_views = user_daily_views.total_views + 1, updated_at = now()
  RETURNING total_views, id, notified_80, notified_100
  INTO _new_total, _row_id, _existing_80, _existing_100;

  IF _new_total > _effective_limit THEN
    UPDATE public.user_daily_views SET total_views = total_views - 1 WHERE id = _row_id;
    RETURN jsonb_build_object('allowed', false, 'currentCount', _new_total - 1, 'limit', _effective_limit, 'race', true);
  END IF;

  IF _session_id IS NOT NULL AND _session_id <> '' THEN
    INSERT INTO public.user_view_sessions(user_id, funnel_id, session_id, view_date, counted)
    VALUES (_owner_id, _funnel_id, _session_id, _today, true)
    ON CONFLICT (session_id, view_date) DO UPDATE SET counted = true;
  END IF;

  IF NOT COALESCE(_existing_80, false) AND _new_total >= CEIL(_effective_limit * 0.8) AND _new_total < _effective_limit THEN
    INSERT INTO public.notifications(user_id, type, title, message, data)
    VALUES (
      _owner_id,
      'view_limit_warning',
      'You''re at 80% of today''s view limit',
      'You''ve used ' || _new_total || ' of your ' || _effective_limit || ' daily views.',
      jsonb_build_object('current', _new_total, 'limit', _effective_limit, 'threshold', 80)
    );
    UPDATE public.user_daily_views SET notified_80 = true WHERE id = _row_id;
  END IF;

  IF NOT COALESCE(_existing_100, false) AND _new_total >= _effective_limit THEN
    INSERT INTO public.notifications(user_id, type, title, message, data)
    VALUES (
      _owner_id,
      'view_limit_reached',
      'Daily view limit reached',
      'New prospects cannot view your funnels until tomorrow.',
      jsonb_build_object('current', _new_total, 'limit', _effective_limit, 'threshold', 100)
    );
    UPDATE public.user_daily_views SET notified_100 = true WHERE id = _row_id;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'currentCount', _new_total, 'limit', _effective_limit);
END;
$function$;

-- Update get_user_monthly_views to honor is_unlimited override
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
  _is_unlimited boolean;
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
         extra_views_purchased, extra_views_expires_at, subscription_status, is_unlimited
    INTO _custom_daily, _selected_daily, _selected_tier_id, _extra, _extra_expires, _sub_status, _is_unlimited
    FROM public.profiles WHERE id = _user_id;

  -- ADMIN UNLIMITED OVERRIDE
  IF COALESCE(_is_unlimited, false) = true THEN
    RETURN jsonb_build_object(
      'used', _used,
      'limit', -1,
      'plan_key', 'unlimited',
      'reset_at', _month_end,
      'mode', 'unlimited',
      'daily_used', COALESCE(_daily_used, 0),
      'daily_limit', -1,
      'extra_purchased', 0,
      'tier_id', _selected_tier_id,
      'override', true
    );
  END IF;

  SELECT plan_key INTO _plan_key
    FROM public.user_subscriptions
   WHERE user_id = _user_id AND status = 'active'
   ORDER BY created_at DESC LIMIT 1;
  IF _plan_key IS NULL THEN _plan_key := 'free'; END IF;

  IF _sub_status = 'trial' AND _plan_key = 'free' THEN
    _plan_key := 'pro';
  END IF;

  IF _plan_key LIKE 'pro%'        THEN _plan_key := 'pro';
  ELSIF _plan_key LIKE 'basic%'   THEN _plan_key := 'basic';
  ELSIF _plan_key LIKE 'enterprise%' THEN _plan_key := 'enterprise';
  END IF;

  SELECT daily_view_limit, view_limit_mode
    INTO _plan_daily, _plan_mode
    FROM public.plan_config WHERE plan_name = _plan_key;

  IF _custom_daily IS NOT NULL THEN
    _eff_daily := _custom_daily;
  ELSIF _selected_daily IS NOT NULL THEN
    _eff_daily := _selected_daily;
  ELSE
    _eff_daily := COALESCE(_plan_daily, 20);
  END IF;

  IF _eff_daily = -1 THEN
    _eff_monthly := -1;
  ELSE
    _eff_monthly := _eff_daily * 30;
  END IF;

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