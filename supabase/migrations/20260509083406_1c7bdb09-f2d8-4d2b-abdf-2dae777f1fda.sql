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
BEGIN
  -- Resolve funnel owner (creator). Views are ALWAYS counted against the creator,
  -- never the viewer. Viewer auth state is irrelevant to this RPC.
  SELECT owner_id INTO _owner_id FROM public.funnels WHERE id = _funnel_id;
  IF _owner_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'funnel_not_found');
  END IF;

  -- Already counted this session today? Allow without incrementing.
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

  -- Read creator's profile overrides + subscription status
  SELECT custom_daily_views_limit, selected_daily_views, subscription_status
    INTO _custom_limit, _selected_daily, _sub_status
    FROM public.profiles WHERE id = _owner_id;

  -- Resolve creator's active plan_key
  SELECT plan_key INTO _plan_key
  FROM public.user_subscriptions
  WHERE user_id = _owner_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  IF _plan_key IS NULL THEN _plan_key := 'free'; END IF;

  -- Trial users get Pro's plan_config (mirrors get_user_monthly_views + usePlanLimits)
  IF _sub_status = 'trial' AND _plan_key = 'free' THEN
    _plan_key := 'pro';
  END IF;

  -- Normalize plan_key variants (pro_monthly -> pro, basic_yearly -> basic, etc.)
  IF _plan_key LIKE 'pro%' THEN _plan_key := 'pro';
  ELSIF _plan_key LIKE 'basic%' THEN _plan_key := 'basic';
  ELSIF _plan_key LIKE 'enterprise%' THEN _plan_key := 'enterprise';
  END IF;

  SELECT daily_view_limit INTO _plan_limit
  FROM public.plan_config
  WHERE plan_name = _plan_key;

  -- Effective daily: admin override > user-selected tier > plan default
  IF _custom_limit IS NOT NULL THEN
    _effective_limit := _custom_limit;
  ELSIF _selected_daily IS NOT NULL THEN
    _effective_limit := _selected_daily;
  ELSE
    _effective_limit := COALESCE(_plan_limit, 20);
  END IF;

  -- Unlimited
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

  -- Check current total before incrementing
  SELECT total_views INTO _new_total
  FROM public.user_daily_views
  WHERE user_id = _owner_id AND view_date = _today;

  IF COALESCE(_new_total, 0) >= _effective_limit THEN
    RETURN jsonb_build_object('allowed', false, 'currentCount', COALESCE(_new_total, 0), 'limit', _effective_limit);
  END IF;

  -- Atomic increment
  INSERT INTO public.user_daily_views(user_id, view_date, total_views)
  VALUES (_owner_id, _today, 1)
  ON CONFLICT (user_id, view_date)
  DO UPDATE SET total_views = user_daily_views.total_views + 1, updated_at = now()
  RETURNING total_views, id, notified_80, notified_100
  INTO _new_total, _row_id, _existing_80, _existing_100;

  -- Race condition guard
  IF _new_total > _effective_limit THEN
    UPDATE public.user_daily_views SET total_views = total_views - 1 WHERE id = _row_id;
    RETURN jsonb_build_object('allowed', false, 'currentCount', _new_total - 1, 'limit', _effective_limit, 'race', true);
  END IF;

  -- Mark session as counted
  IF _session_id IS NOT NULL AND _session_id <> '' THEN
    INSERT INTO public.user_view_sessions(user_id, funnel_id, session_id, view_date, counted)
    VALUES (_owner_id, _funnel_id, _session_id, _today, true)
    ON CONFLICT (session_id, view_date) DO UPDATE SET counted = true;
  END IF;

  -- 80% threshold notification
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

  -- 100% threshold notification
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