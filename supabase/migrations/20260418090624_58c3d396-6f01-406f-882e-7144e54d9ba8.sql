
-- Re-create with explicit search_path (the only way to add it to existing functions)
CREATE OR REPLACE FUNCTION public.increment_funnel_daily_view(_funnel_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

CREATE OR REPLACE FUNCTION public.is_nevorai_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT nevorai_member AND nevorai_member_active FROM public.profiles WHERE id = _user_id),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_member_otps()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM public.member_otps WHERE expires_at < now() - interval '1 hour';
$$;
