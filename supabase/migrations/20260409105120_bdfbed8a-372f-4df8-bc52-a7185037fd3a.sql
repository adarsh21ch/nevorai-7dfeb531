
ALTER TABLE public.plan_config
  ADD COLUMN IF NOT EXISTS feature_lead_capture boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_analytics boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_whatsapp_automation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_video_sharing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_priority_support boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_advanced_analytics boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_go_live boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_landing_pages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_team_analytics boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_badge_text text DEFAULT NULL;

UPDATE public.plan_config SET
  feature_lead_capture = true,
  feature_analytics = true,
  feature_whatsapp_automation = true,
  feature_video_sharing = false,
  feature_priority_support = false,
  feature_advanced_analytics = false,
  feature_go_live = true,
  feature_landing_pages = true,
  feature_team_analytics = false,
  plan_badge_text = 'For Individuals · 1 Person'
WHERE plan_name = 'basic';

UPDATE public.plan_config SET
  feature_lead_capture = true,
  feature_analytics = true,
  feature_whatsapp_automation = true,
  feature_video_sharing = true,
  feature_priority_support = true,
  feature_advanced_analytics = true,
  feature_go_live = true,
  feature_landing_pages = true,
  feature_team_analytics = true,
  plan_badge_text = 'For Your Whole Team'
WHERE plan_name = 'pro';
