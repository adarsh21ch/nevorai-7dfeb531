-- Rename leaders → enterprise
UPDATE public.plan_config SET plan_name = 'enterprise' WHERE plan_name = 'leaders';

-- Basic defaults
UPDATE public.plan_config SET
  max_funnels = 5,
  max_videos = 10,
  max_storage_mb = 5120,
  max_landing_pages = 0,
  max_live_sessions = 0,
  daily_view_limit = 50,
  max_leads = 500,
  max_team_members = 0,
  feature_funnel_creation = true,
  feature_lead_capture = true,
  feature_video_upload = true,
  feature_youtube_import = true,
  feature_video_sharing = true,
  feature_landing_pages = false,
  feature_go_live = false,
  feature_whatsapp_automation = false,
  feature_smart_reminders = false,
  feature_analytics = true,
  feature_advanced_analytics = false,
  feature_prospect_analytics = false,
  feature_insights = false,
  multilevel_funnel_enabled = false,
  feature_team_analytics = false,
  feature_custom_branding = false,
  feature_priority_support = true
WHERE plan_name = 'basic';

-- Pro defaults
UPDATE public.plan_config SET
  max_funnels = 15,
  max_videos = 30,
  max_storage_mb = 10240,
  max_landing_pages = 1,
  max_live_sessions = 1,
  daily_view_limit = 500,
  max_leads = -1,
  max_team_members = 50,
  feature_funnel_creation = true,
  feature_lead_capture = true,
  feature_video_upload = true,
  feature_youtube_import = true,
  feature_video_sharing = true,
  feature_landing_pages = true,
  feature_go_live = true,
  feature_whatsapp_automation = true,
  feature_smart_reminders = true,
  feature_analytics = true,
  feature_advanced_analytics = true,
  feature_prospect_analytics = true,
  feature_insights = true,
  multilevel_funnel_enabled = true,
  feature_team_analytics = true,
  feature_custom_branding = true,
  feature_priority_support = true
WHERE plan_name = 'pro';

-- Enterprise defaults (everything unlimited / on)
INSERT INTO public.plan_config (plan_name, monthly_price, yearly_price, plan_badge_text)
VALUES ('enterprise', 4999, 49999, 'For Large Networks')
ON CONFLICT (plan_name) DO NOTHING;

UPDATE public.plan_config SET
  max_funnels = -1,
  max_videos = -1,
  max_storage_mb = -1,
  max_landing_pages = -1,
  max_live_sessions = -1,
  daily_view_limit = -1,
  max_leads = -1,
  max_team_members = -1,
  feature_funnel_creation = true,
  feature_lead_capture = true,
  feature_video_upload = true,
  feature_youtube_import = true,
  feature_video_sharing = true,
  feature_landing_pages = true,
  feature_go_live = true,
  feature_whatsapp_automation = true,
  feature_smart_reminders = true,
  feature_analytics = true,
  feature_advanced_analytics = true,
  feature_prospect_analytics = true,
  feature_insights = true,
  multilevel_funnel_enabled = true,
  feature_team_analytics = true,
  feature_custom_branding = true,
  feature_priority_support = true,
  plan_badge_text = COALESCE(NULLIF(plan_badge_text, ''), 'For Large Networks')
WHERE plan_name = 'enterprise';