-- Gate landing page confirmation email behind paid plans.
-- Adds a per-plan feature flag in plan_config (default false), enables it
-- for Basic and Pro plans, leaves Free disabled. Run this SQL in Supabase.

ALTER TABLE public.plan_config
  ADD COLUMN IF NOT EXISTS feature_landing_page_email boolean NOT NULL DEFAULT false;

UPDATE public.plan_config
SET feature_landing_page_email = true
WHERE plan_name IN ('basic', 'pro');

UPDATE public.plan_config
SET feature_landing_page_email = false
WHERE plan_name = 'free';
