-- ============================================================
-- Additive migration: per-step access codes, per-step speakers,
-- landing-page access codes, step access attempt logging.
-- No existing columns or rows are modified.
-- ============================================================

-- 1) funnel_steps: per-step access code + per-step speaker override
ALTER TABLE public.funnel_steps
  ADD COLUMN IF NOT EXISTS access_code_enabled  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_code_plain    text,
  ADD COLUMN IF NOT EXISTS speaker_mode_step    text NOT NULL DEFAULT 'inherit',
  ADD COLUMN IF NOT EXISTS speaker_name_custom  text,
  ADD COLUMN IF NOT EXISTS speaker_title        text,
  ADD COLUMN IF NOT EXISTS speaker_bio          text,
  ADD COLUMN IF NOT EXISTS speaker_photo_url_custom text;

COMMENT ON COLUMN public.funnel_steps.access_code_enabled IS 'When true, viewer must enter access_code_plain to unlock this specific step';
COMMENT ON COLUMN public.funnel_steps.speaker_mode_step  IS 'inherit = use funnel-level speaker; custom = use this step''s custom speaker fields';

-- 2) landing_pages: optional access-code lock for the whole page
ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS access_code_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_code_plain   text;

COMMENT ON COLUMN public.landing_pages.access_code_enabled IS 'When true, viewer must enter access_code_plain to view the landing page';

-- 3) funnel_step_progress: track per-session step-code unlock
ALTER TABLE public.funnel_step_progress
  ADD COLUMN IF NOT EXISTS access_code_unlocked boolean NOT NULL DEFAULT false;

-- 4) step_access_logs: audit trail for step access-code attempts
CREATE TABLE IF NOT EXISTS public.step_access_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id       uuid NOT NULL,
  funnel_step_id  uuid NOT NULL,
  session_id      text,
  code_attempted  text,
  success         boolean NOT NULL DEFAULT false,
  ip_address      text,
  attempted_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_step_access_logs_step_attempted
  ON public.step_access_logs (funnel_step_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_step_access_logs_session
  ON public.step_access_logs (session_id, funnel_step_id);

ALTER TABLE public.step_access_logs ENABLE ROW LEVEL SECURITY;

-- Owner of the funnel can read attempts for their own steps
CREATE POLICY owner_read_step_access_logs
  ON public.step_access_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.funnels f
      WHERE f.id = step_access_logs.funnel_id
        AND f.owner_id = auth.uid()
    )
  );

-- Admins can read all attempts (matches funnel_access_logs pattern)
CREATE POLICY admin_full_step_access_logs
  ON public.step_access_logs
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone (including unauthenticated public viewers) can insert an attempt.
-- The edge function is the canonical writer; this policy keeps inserts working
-- if a future direct-insert path is ever added.
CREATE POLICY public_insert_step_access_logs
  ON public.step_access_logs
  FOR INSERT
  WITH CHECK (true);
