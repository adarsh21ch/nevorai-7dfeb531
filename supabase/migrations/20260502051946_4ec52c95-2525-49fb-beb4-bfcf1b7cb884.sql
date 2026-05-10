-- 1. Add toggle column
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS show_viewer_count boolean NOT NULL DEFAULT true;

-- 2. Function: count distinct viewer tokens with a heartbeat in the last 30s for a given slot
CREATE OR REPLACE FUNCTION public.get_live_concurrent_viewers(
  _session_id uuid,
  _session_slot timestamptz
) RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT viewer_token)::int
  FROM public.live_session_heartbeats
  WHERE session_id = _session_id
    AND session_slot = _session_slot
    AND last_seen_at > now() - interval '30 seconds';
$$;

GRANT EXECUTE ON FUNCTION public.get_live_concurrent_viewers(uuid, timestamptz) TO anon, authenticated;