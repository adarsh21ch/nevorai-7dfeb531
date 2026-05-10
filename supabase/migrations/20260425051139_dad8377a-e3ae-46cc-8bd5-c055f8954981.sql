-- Track every failed login attempt, scoped by email + IP
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  ip_address text,
  succeeded boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_lookup
  ON public.auth_attempts (lower(email), ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_attempted_at
  ON public.auth_attempts (attempted_at);

-- Lock the table down: no direct client access. Only SECURITY DEFINER functions.
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies → no role can SELECT/INSERT/UPDATE/DELETE from the client.

-- Check whether (email, ip) is currently locked out due to repeated failures.
CREATE OR REPLACE FUNCTION public.check_auth_lockout(_email text, _ip text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _max_attempts constant int := 5;
  _window interval := interval '30 minutes';
  _fail_count int;
  _last_fail timestamptz;
  _normalized text := lower(trim(coalesce(_email, '')));
BEGIN
  IF _normalized = '' THEN
    RETURN jsonb_build_object('locked', false, 'attempts', 0);
  END IF;

  SELECT count(*), max(attempted_at)
  INTO _fail_count, _last_fail
  FROM public.auth_attempts
  WHERE lower(email) = _normalized
    AND (ip_address = _ip OR _ip IS NULL)
    AND succeeded = false
    AND attempted_at > now() - _window;

  IF _fail_count >= _max_attempts THEN
    RETURN jsonb_build_object(
      'locked', true,
      'attempts', _fail_count,
      'unlock_at', (_last_fail + _window)
    );
  END IF;

  RETURN jsonb_build_object(
    'locked', false,
    'attempts', _fail_count,
    'remaining', _max_attempts - _fail_count
  );
END;
$$;

-- Record a login attempt. On success, clears the failure history for this (email, ip).
CREATE OR REPLACE FUNCTION public.record_auth_attempt(_email text, _ip text, _success boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _normalized text := lower(trim(coalesce(_email, '')));
BEGIN
  IF _normalized = '' THEN RETURN; END IF;

  INSERT INTO public.auth_attempts (email, ip_address, succeeded)
  VALUES (_normalized, _ip, _success);

  IF _success THEN
    -- Wipe the failure trail on a real successful login
    DELETE FROM public.auth_attempts
    WHERE lower(email) = _normalized
      AND succeeded = false;
  END IF;

  -- Opportunistic cleanup of very old rows
  DELETE FROM public.auth_attempts
  WHERE attempted_at < now() - interval '7 days';
END;
$$;

-- Allow the anon and authenticated roles to call the RPCs (but not touch the table)
GRANT EXECUTE ON FUNCTION public.check_auth_lockout(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_auth_attempt(text, text, boolean) TO anon, authenticated;