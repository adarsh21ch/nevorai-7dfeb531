-- =====================================================================
-- Feature gate: "Allow viewers to skip forward" (per-video toggle)
-- Source of truth = admin panel → Plans → Features → "Skip-Forward Control"
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

-- 1) Add the column (default OFF so Free does NOT get it by accident).
ALTER TABLE public.plan_config
  ADD COLUMN IF NOT EXISTS feature_skip_control boolean NOT NULL DEFAULT false;

-- 2) Seed defaults: enable for Basic + Pro, keep disabled for Free.
--    You can change any of these later from the admin panel — the panel
--    is the source of truth from here on.
UPDATE public.plan_config SET feature_skip_control = false WHERE plan_name = 'free';
UPDATE public.plan_config SET feature_skip_control = true  WHERE plan_name IN ('basic', 'pro');
