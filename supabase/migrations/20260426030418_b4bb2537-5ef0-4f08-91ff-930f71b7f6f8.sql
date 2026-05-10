-- Additive columns on funnel_step_progress to support advanced unlock tracking
ALTER TABLE public.funnel_step_progress
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permanently_unlocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS condition_met_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_funnel_step_progress_perma
  ON public.funnel_step_progress (funnel_id, session_id, permanently_unlocked);