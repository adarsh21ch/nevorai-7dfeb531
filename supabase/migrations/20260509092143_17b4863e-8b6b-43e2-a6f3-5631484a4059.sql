
ALTER TABLE public.plan_view_tiers
  ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

UPDATE public.plan_view_tiers SET is_base = true
  WHERE plan_name = 'basic' AND daily_views = 20;

UPDATE public.plan_view_tiers SET is_base = true
  WHERE plan_name = 'pro' AND daily_views = 200;

-- Enforce single base per plan (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS plan_view_tiers_one_base_per_plan
  ON public.plan_view_tiers (plan_name)
  WHERE is_base = true;
