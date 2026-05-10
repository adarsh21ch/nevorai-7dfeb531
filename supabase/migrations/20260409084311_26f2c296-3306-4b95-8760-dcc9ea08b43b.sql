-- Add new limit columns
ALTER TABLE public.admin_subscription_plans
  ADD COLUMN IF NOT EXISTS landing_page_limit integer,
  ADD COLUMN IF NOT EXISTS live_session_limit integer,
  ADD COLUMN IF NOT EXISTS multi_step_funnel_enabled boolean NOT NULL DEFAULT false;

-- Deactivate old plans
UPDATE public.admin_subscription_plans SET is_active = false;

-- Seed new plans
INSERT INTO public.admin_subscription_plans (plan_key, label, tier, billing_type, price_inr, duration_days, funnel_limit, video_limit, video_max_size_mb, landing_page_limit, live_session_limit, multi_step_funnel_enabled, is_active, features)
VALUES
  ('free', 'Free', 'free', 'free', 0, NULL, 1, 3, 100, 1, 0, false, true,
   '["1 Funnel","3 Videos (100MB)","1 Landing Page","Basic Analytics","Lead Capture"]'::jsonb),
  ('basic_monthly', 'Basic Monthly', 'basic', 'monthly', 499, 30, 5, 20, 500, 3, 2, false, true,
   '["5 Funnels","20 Videos (500MB)","3 Landing Pages","2 Live Sessions","Advanced Analytics","Lead Capture","WhatsApp Auto-message"]'::jsonb),
  ('basic_yearly', 'Basic Yearly', 'basic', 'one_time', 2999, 365, 5, 20, 500, 3, 2, false, true,
   '["Everything in Basic Monthly","365-day access","Best value for individuals"]'::jsonb),
  ('pro_monthly', 'Pro Monthly', 'pro', 'monthly', 999, 30, NULL, NULL, 2048, NULL, NULL, true, true,
   '["Unlimited Funnels","Unlimited Videos (2GB)","Unlimited Landing Pages","Unlimited Live Sessions","Multi-step Journeys","Advanced Analytics","WhatsApp Automation","Video Sharing","Priority Support"]'::jsonb),
  ('pro_yearly', 'Pro Yearly', 'pro', 'one_time', 5999, 365, NULL, NULL, 2048, NULL, NULL, true, true,
   '["Everything in Pro Monthly","365-day access","Best value for teams"]'::jsonb)
ON CONFLICT (plan_key) DO UPDATE SET
  label = EXCLUDED.label,
  tier = EXCLUDED.tier,
  billing_type = EXCLUDED.billing_type,
  price_inr = EXCLUDED.price_inr,
  duration_days = EXCLUDED.duration_days,
  funnel_limit = EXCLUDED.funnel_limit,
  video_limit = EXCLUDED.video_limit,
  video_max_size_mb = EXCLUDED.video_max_size_mb,
  landing_page_limit = EXCLUDED.landing_page_limit,
  live_session_limit = EXCLUDED.live_session_limit,
  multi_step_funnel_enabled = EXCLUDED.multi_step_funnel_enabled,
  is_active = EXCLUDED.is_active,
  features = EXCLUDED.features;