-- Run this once in the Supabase SQL editor.
-- Adds per-step skip + next-step lock controls to funnel_steps so a video
-- used in a funnel can have its own skip / unlock policy independent of
-- the video gallery (video_assets.allow_seek).
ALTER TABLE public.funnel_steps
  ADD COLUMN IF NOT EXISTS allow_skip BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS lock_next_step BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS unlock_after_percent INTEGER NOT NULL DEFAULT 85;

-- Backfill: existing steps should keep the default-enabled behavior.
UPDATE public.funnel_steps
  SET unlock_after_percent = LEAST(GREATEST(COALESCE(unlock_percentage, 85), 1), 100)
  WHERE unlock_after_percent = 85 AND unlock_percentage IS NOT NULL;

ALTER TABLE public.funnel_steps
  DROP CONSTRAINT IF EXISTS funnel_steps_unlock_after_percent_check;
ALTER TABLE public.funnel_steps
  ADD CONSTRAINT funnel_steps_unlock_after_percent_check
  CHECK (unlock_after_percent BETWEEN 1 AND 100);
