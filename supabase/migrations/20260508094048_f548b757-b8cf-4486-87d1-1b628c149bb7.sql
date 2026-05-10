-- Add new feature/limit columns to plan_config to support the unified PLAN_FEATURES config.
-- Existing fields kept and reused (daily_view_limit, max_storage_mb, feature_team_analytics).

ALTER TABLE public.plan_config
  ADD COLUMN IF NOT EXISTS max_leads integer DEFAULT -1,
  ADD COLUMN IF NOT EXISTS feature_youtube_import boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_custom_branding boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_smart_reminders boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_prospect_analytics boolean DEFAULT false;

-- Sensible defaults per plan (only updates if column was just created with NULL/false)
UPDATE public.plan_config SET
  max_leads = CASE plan_name WHEN 'free' THEN 50 WHEN 'basic' THEN 500 ELSE -1 END
WHERE max_leads IS NULL OR max_leads = -1 AND plan_name IN ('free','basic');

UPDATE public.plan_config SET feature_youtube_import = true WHERE plan_name IN ('basic','pro','leaders');
UPDATE public.plan_config SET feature_custom_branding = true WHERE plan_name IN ('pro','leaders');
UPDATE public.plan_config SET feature_smart_reminders = true WHERE plan_name IN ('pro','leaders');
UPDATE public.plan_config SET feature_prospect_analytics = true WHERE plan_name IN ('pro','leaders');