-- ============================================================================
-- Dynamic Plan Management migration
-- Run in Supabase SQL editor. Idempotent.
-- ============================================================================

-- 1) New metadata columns on plan_config
ALTER TABLE public.plan_config
  ADD COLUMN IF NOT EXISTS display_name  TEXT,
  ADD COLUMN IF NOT EXISTS description   TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 100;

-- 2) Drop hardcoded CHECK constraints (so admin can create new plans freely)
ALTER TABLE public.plan_config        DROP CONSTRAINT IF EXISTS plan_config_plan_name_check;
ALTER TABLE public.plan_view_tiers    DROP CONSTRAINT IF EXISTS plan_view_tiers_plan_name_check;
ALTER TABLE public.subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_tier_check;

-- 3) Format-only check (lowercase a-z, digits, underscores; must start with letter)
ALTER TABLE public.plan_config DROP CONSTRAINT IF EXISTS plan_config_plan_name_format;
ALTER TABLE public.plan_config
  ADD CONSTRAINT plan_config_plan_name_format
  CHECK (plan_name ~ '^[a-z][a-z0-9_]*$');

-- 4) Backfill display_name / display_order for existing rows
UPDATE public.plan_config
SET display_name = INITCAP(plan_name)
WHERE display_name IS NULL OR display_name = '';

UPDATE public.plan_config
SET display_order = CASE plan_name
  WHEN 'free'   THEN 10
  WHEN 'basic'  THEN 20
  WHEN 'growth' THEN 30
  WHEN 'pro'    THEN 40
  ELSE display_order
END
WHERE plan_name IN ('free','basic','growth','pro');
