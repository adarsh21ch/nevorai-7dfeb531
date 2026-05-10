
-- Heartbeat tracking table for unique viewers / peak concurrent
CREATE TABLE IF NOT EXISTS public.live_session_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  session_slot timestamptz NOT NULL,
  viewer_token text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  watch_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, session_slot, viewer_token)
);

CREATE INDEX IF NOT EXISTS idx_lsh_session_slot ON public.live_session_heartbeats(session_id, session_slot);
CREATE INDEX IF NOT EXISTS idx_lsh_last_seen ON public.live_session_heartbeats(last_seen_at);

ALTER TABLE public.live_session_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages heartbeats"
  ON public.live_session_heartbeats FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Owners read own heartbeats"
  ON public.live_session_heartbeats FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.live_sessions s WHERE s.id = live_session_heartbeats.session_id AND s.owner_id = auth.uid()));

-- RPC: record_live_heartbeat (callable by anon — no PII, only opaque token)
CREATE OR REPLACE FUNCTION public.record_live_heartbeat(
  _session_id uuid,
  _session_slot timestamptz,
  _viewer_token text,
  _delta_seconds integer DEFAULT 15
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _slot_exists boolean;
  _unique_count integer;
  _peak_count integer;
  _total_watch integer;
  _concurrent integer;
BEGIN
  IF _viewer_token IS NULL OR length(_viewer_token) < 8 OR length(_viewer_token) > 128 THEN
    RETURN;
  END IF;
  IF _delta_seconds < 0 OR _delta_seconds > 120 THEN
    _delta_seconds := 15;
  END IF;

  -- Verify session exists & published-ish
  SELECT EXISTS (
    SELECT 1 FROM public.live_sessions
    WHERE id = _session_id AND status IN ('scheduled','live','ended')
  ) INTO _slot_exists;
  IF NOT _slot_exists THEN RETURN; END IF;

  -- Upsert heartbeat
  INSERT INTO public.live_session_heartbeats(session_id, session_slot, viewer_token, last_seen_at, watch_seconds)
  VALUES (_session_id, _session_slot, _viewer_token, now(), _delta_seconds)
  ON CONFLICT (session_id, session_slot, viewer_token)
  DO UPDATE SET
    last_seen_at = now(),
    watch_seconds = public.live_session_heartbeats.watch_seconds + EXCLUDED.watch_seconds;

  -- Recompute aggregates for this slot
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE last_seen_at > now() - interval '45 seconds')::int,
    coalesce(sum(watch_seconds), 0)::int
  INTO _unique_count, _concurrent, _total_watch
  FROM public.live_session_heartbeats
  WHERE session_id = _session_id AND session_slot = _session_slot;

  INSERT INTO public.live_session_analytics(session_id, session_slot, unique_viewers, peak_concurrent, total_watch_seconds)
  VALUES (_session_id, _session_slot, _unique_count, _concurrent, _total_watch)
  ON CONFLICT (session_id, session_slot) DO UPDATE SET
    unique_viewers = EXCLUDED.unique_viewers,
    peak_concurrent = GREATEST(public.live_session_analytics.peak_concurrent, EXCLUDED.peak_concurrent),
    total_watch_seconds = EXCLUDED.total_watch_seconds;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_live_heartbeat(uuid, timestamptz, text, integer) TO anon, authenticated;

-- Enable pg_cron + pg_net if not already
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cron: every 5 min, ping the reminder edge function
DO $$
BEGIN
  PERFORM cron.unschedule('live-session-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'live-session-reminders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://atwnmovdnblcqyvhaxls.supabase.co/functions/v1/send-live-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('source', 'cron')
  ) AS request_id;
  $$
);
