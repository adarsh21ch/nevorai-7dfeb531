-- 1. Rename old per-funnel table (keep data for 30 days, do not drop)
ALTER TABLE IF EXISTS public.funnel_daily_views RENAME TO funnel_daily_views_old;

-- 2. New per-user daily totals
CREATE TABLE IF NOT EXISTS public.user_daily_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  view_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  total_views integer NOT NULL DEFAULT 0,
  notified_80 boolean NOT NULL DEFAULT false,
  notified_100 boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, view_date)
);

CREATE INDEX IF NOT EXISTS idx_user_daily_views_user_date ON public.user_daily_views(user_id, view_date DESC);

ALTER TABLE public.user_daily_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages user daily views"
ON public.user_daily_views FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users read own daily views"
ON public.user_daily_views FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins read all daily views"
ON public.user_daily_views FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Per-session dedup (per creator)
CREATE TABLE IF NOT EXISTS public.user_view_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  funnel_id uuid NOT NULL,
  session_id text NOT NULL,
  view_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  counted boolean NOT NULL DEFAULT false,
  UNIQUE (session_id, view_date)
);

CREATE INDEX IF NOT EXISTS idx_user_view_sessions_user_date ON public.user_view_sessions(user_id, view_date DESC);

ALTER TABLE public.user_view_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages user view sessions"
ON public.user_view_sessions FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 4. Per-user admin override
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_daily_views_limit integer;

-- 5. Trigger: keep updated_at fresh
CREATE OR REPLACE FUNCTION public.tg_user_daily_views_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_daily_views_updated_at ON public.user_daily_views;
CREATE TRIGGER trg_user_daily_views_updated_at
BEFORE UPDATE ON public.user_daily_views
FOR EACH ROW EXECUTE FUNCTION public.tg_user_daily_views_updated_at();

-- 6. Drop old per-funnel RPC (replaced by per-user version below)
DROP FUNCTION IF EXISTS public.increment_funnel_daily_view(uuid);

-- 7. New per-user atomic increment with notifications
CREATE OR REPLACE FUNCTION public.increment_user_daily_view(
  _funnel_id uuid,
  _session_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _owner_id uuid;
  _plan_key text;
  _plan_limit integer;
  _custom_limit integer;
  _effective_limit integer;
  _new_total integer;
  _already_counted boolean;
  _existing_80 boolean;
  _existing_100 boolean;
  _row_id uuid;
BEGIN
  -- Resolve funnel owner
  SELECT owner_id INTO _owner_id FROM public.funnels WHERE id = _funnel_id;
  IF _owner_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'funnel_not_found');
  END IF;

  -- Already counted this session today? Allow without incrementing
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

  -- Resolve effective limit (custom override > plan default)
  SELECT custom_daily_views_limit INTO _custom_limit FROM public.profiles WHERE id = _owner_id;

  SELECT plan_key INTO _plan_key
  FROM public.user_subscriptions
  WHERE user_id = _owner_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF _plan_key IS NULL THEN _plan_key := 'free'; END IF;

  SELECT daily_view_limit INTO _plan_limit
  FROM public.plan_config
  WHERE plan_name = _plan_key;

  _effective_limit := COALESCE(_custom_limit, _plan_limit, 20);

  -- Unlimited
  IF _effective_limit = -1 THEN
    -- Still record the session for accurate analytics
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

  -- Race condition: someone snuck past limit
  IF _new_total > _effective_limit THEN
    -- Roll back the increment
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
      'You''ve used ' || _new_total || ' of your ' || _effective_limit || ' daily views. Upgrade to Pro for 500/day.',
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
      'New prospects cannot view your funnels until tomorrow. Upgrade to Pro for 500 daily views.',
      jsonb_build_object('current', _new_total, 'limit', _effective_limit, 'threshold', 100)
    );
    UPDATE public.user_daily_views SET notified_100 = true WHERE id = _row_id;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'currentCount', _new_total, 'limit', _effective_limit);
END;
$$;

-- 8. Allow notifications inserts from service role / definer functions
DROP POLICY IF EXISTS "Service role inserts notifications" ON public.notifications;
CREATE POLICY "Service role inserts notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.role() = 'service_role');