-- Apply manually in Supabase SQL editor.
-- Free tier launch: branding flag, disable trial, backfill free subs.

ALTER TABLE public.plan_config
  ADD COLUMN IF NOT EXISTS feature_show_branding boolean NOT NULL DEFAULT false;

INSERT INTO public.plan_config (
  plan_name, monthly_price, yearly_price, max_funnels, max_landing_pages,
  max_live_sessions, max_team_members, multilevel_funnel_enabled, feature_show_branding
)
VALUES ('free', 0, 0, 1, 1, 0, 0, false, true)
ON CONFLICT (plan_name) DO NOTHING;

UPDATE public.plan_config
SET feature_show_branding = true
WHERE plan_name = 'free' AND feature_show_branding IS DISTINCT FROM true;

UPDATE public.app_settings SET value = 'false', updated_at = now() WHERE key = 'trial_enabled';
INSERT INTO public.app_settings (key, value)
VALUES ('trial_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.user_subscriptions (user_id, plan_key, tier, status, billing_type)
SELECT p.id, 'free', 'free', 'active', 'free'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_subscriptions us
  WHERE us.user_id = p.id AND us.status IN ('active','pending','payment_failed')
);
