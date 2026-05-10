-- Add new columns to plan_config
ALTER TABLE public.plan_config
  ADD COLUMN IF NOT EXISTS max_videos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_storage_mb integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feature_video_upload boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_insights boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_funnel_creation boolean NOT NULL DEFAULT true;

-- Insert free plan config (only if not exists)
INSERT INTO public.plan_config (
  plan_name, monthly_price, yearly_price, yearly_validity_days,
  max_funnels, max_landing_pages, max_live_sessions, max_team_members,
  max_videos, max_storage_mb,
  multilevel_funnel_enabled, is_enabled,
  feature_lead_capture, feature_analytics, feature_whatsapp_automation,
  feature_video_sharing, feature_priority_support, feature_advanced_analytics,
  feature_go_live, feature_landing_pages, feature_team_analytics,
  feature_video_upload, feature_insights, feature_funnel_creation
) VALUES (
  'free', 0, 0, 0,
  0, 0, 0, 0,
  0, 0,
  false, true,
  false, false, false,
  false, false, false,
  false, false, false,
  false, false, false
) ON CONFLICT DO NOTHING;

-- Update existing basic plan with new column defaults
UPDATE public.plan_config SET
  max_videos = 10,
  max_storage_mb = 1024,
  feature_video_upload = true,
  feature_insights = true,
  feature_funnel_creation = true
WHERE plan_name = 'basic';

-- Update existing pro plan with new column defaults
UPDATE public.plan_config SET
  max_videos = -1,
  max_storage_mb = 10240,
  feature_video_upload = true,
  feature_insights = true,
  feature_funnel_creation = true
WHERE plan_name = 'pro';