-- Section 1: Ensure plan_view_tiers shape
ALTER TABLE public.plan_view_tiers
  ADD COLUMN IF NOT EXISTS is_base    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active  boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_popular boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yearly_price integer;

UPDATE public.plan_view_tiers
SET yearly_price = ROUND(monthly_price * 12 * 0.83)
WHERE yearly_price IS NULL AND monthly_price IS NOT NULL;

-- Reset and re-mark base tiers (lowest daily_views per plan)
UPDATE public.plan_view_tiers SET is_base = false;
UPDATE public.plan_view_tiers SET is_base = true
WHERE id IN (
  SELECT DISTINCT ON (plan_name) id
  FROM public.plan_view_tiers
  WHERE is_active = true
  ORDER BY plan_name, daily_views ASC
);

-- Reset and re-mark popular tiers
UPDATE public.plan_view_tiers SET is_popular = false;
UPDATE public.plan_view_tiers SET is_popular = true
WHERE (plan_name = 'basic' AND daily_views = 50)
   OR (plan_name = 'pro'   AND daily_views = 500);

-- Display order = daily_views
UPDATE public.plan_view_tiers SET display_order = daily_views;

-- Drop price columns from plan_config (prices live on tiers only)
ALTER TABLE public.plan_config DROP COLUMN IF EXISTS monthly_price;
ALTER TABLE public.plan_config DROP COLUMN IF EXISTS yearly_price;

-- Seed Basic tiers if missing
INSERT INTO public.plan_view_tiers (plan_name, daily_views, monthly_price, yearly_price, is_base, is_popular, is_active, display_order)
SELECT * FROM (VALUES
  ('basic',  20,  149, 1490, true,  false, true, 20),
  ('basic',  30,  199, 1990, false, false, true, 30),
  ('basic',  50,  249, 2490, false, true,  true, 50),
  ('basic',  70,  329, 3290, false, false, true, 70),
  ('basic', 100,  399, 3990, false, false, true, 100)
) AS v(plan_name, daily_views, monthly_price, yearly_price, is_base, is_popular, is_active, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.plan_view_tiers t
  WHERE t.plan_name = v.plan_name AND t.daily_views = v.daily_views
);

-- Seed Pro tiers if missing
INSERT INTO public.plan_view_tiers (plan_name, daily_views, monthly_price, yearly_price, is_base, is_popular, is_active, display_order)
SELECT * FROM (VALUES
  ('pro',  200,  599,  5990, true,  false, true, 200),
  ('pro',  500,  799,  7990, false, true,  true, 500),
  ('pro', 1000, 1199, 11990, false, false, true, 1000),
  ('pro', 2000, 1799, 17990, false, false, true, 2000)
) AS v(plan_name, daily_views, monthly_price, yearly_price, is_base, is_popular, is_active, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.plan_view_tiers t
  WHERE t.plan_name = v.plan_name AND t.daily_views = v.daily_views
);

-- Section 2: Public pricing RPC
CREATE OR REPLACE FUNCTION public.get_plan_pricing()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  basic_tiers json;
  pro_tiers   json;
  basic_base  json;
  pro_base    json;
BEGIN
  SELECT json_agg(t ORDER BY (t->>'display_order')::int ASC) INTO basic_tiers FROM (
    SELECT json_build_object(
      'id', id,
      'daily_views', daily_views,
      'monthly_views', daily_views * 30,
      'monthly_price', monthly_price,
      'yearly_price', yearly_price,
      'is_base', is_base,
      'is_popular', is_popular,
      'display_order', display_order
    ) AS t
    FROM public.plan_view_tiers
    WHERE plan_name = 'basic' AND is_active = true
  ) sub;

  SELECT json_agg(t ORDER BY (t->>'display_order')::int ASC) INTO pro_tiers FROM (
    SELECT json_build_object(
      'id', id,
      'daily_views', daily_views,
      'monthly_views', daily_views * 30,
      'monthly_price', monthly_price,
      'yearly_price', yearly_price,
      'is_base', is_base,
      'is_popular', is_popular,
      'display_order', display_order
    ) AS t
    FROM public.plan_view_tiers
    WHERE plan_name = 'pro' AND is_active = true
  ) sub;

  SELECT json_build_object(
    'daily_views', daily_views,
    'monthly_price', monthly_price,
    'yearly_price', yearly_price
  ) INTO basic_base
  FROM public.plan_view_tiers
  WHERE plan_name = 'basic' AND is_base = true AND is_active = true
  LIMIT 1;

  SELECT json_build_object(
    'daily_views', daily_views,
    'monthly_price', monthly_price,
    'yearly_price', yearly_price
  ) INTO pro_base
  FROM public.plan_view_tiers
  WHERE plan_name = 'pro' AND is_base = true AND is_active = true
  LIMIT 1;

  RETURN json_build_object(
    'basic', json_build_object('base', basic_base, 'tiers', COALESCE(basic_tiers, '[]'::json)),
    'pro',   json_build_object('base', pro_base,   'tiers', COALESCE(pro_tiers,   '[]'::json))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_plan_pricing() TO anon, authenticated;