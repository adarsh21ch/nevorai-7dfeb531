-- Gate landing page confirmation email behind paid plans.
-- Initial policy: Pro-only. Admin can flip via the Plans page.
-- Run this in the Supabase SQL editor.

ALTER TABLE public.plan_config
  ADD COLUMN IF NOT EXISTS feature_landing_page_email boolean NOT NULL DEFAULT false;

UPDATE public.plan_config SET feature_landing_page_email = true  WHERE plan_name = 'pro';
UPDATE public.plan_config SET feature_landing_page_email = false WHERE plan_name IN ('basic', 'free');
