-- 1. Add new columns to live_sessions for simulated-live playback
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS funnel_id uuid,
  ADD COLUMN IF NOT EXISTS video_asset_id uuid,
  ADD COLUMN IF NOT EXISTS video_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS scheduled_times jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS replay_available_after_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;

-- Helpful index for resolving sessions by linked funnel
CREATE INDEX IF NOT EXISTS idx_live_sessions_funnel_id ON public.live_sessions(funnel_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_owner_status ON public.live_sessions(owner_id, status);

-- 2. Per-slot analytics table
CREATE TABLE IF NOT EXISTS public.live_session_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  session_slot timestamptz NOT NULL,
  unique_viewers integer NOT NULL DEFAULT 0,
  peak_concurrent integer NOT NULL DEFAULT 0,
  total_watch_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, session_slot)
);

CREATE INDEX IF NOT EXISTS idx_live_session_analytics_session ON public.live_session_analytics(session_id);

ALTER TABLE public.live_session_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own session analytics" ON public.live_session_analytics;
CREATE POLICY "Owners read own session analytics"
  ON public.live_session_analytics
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.live_sessions s
    WHERE s.id = live_session_analytics.session_id
      AND s.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins read all session analytics" ON public.live_session_analytics;
CREATE POLICY "Admins read all session analytics"
  ON public.live_session_analytics
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role manages session analytics" ON public.live_session_analytics;
CREATE POLICY "Service role manages session analytics"
  ON public.live_session_analytics
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');