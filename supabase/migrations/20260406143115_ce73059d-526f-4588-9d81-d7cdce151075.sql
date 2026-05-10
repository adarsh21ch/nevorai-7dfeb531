CREATE OR REPLACE FUNCTION public.increment_funnel_views(_funnel_id uuid)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE funnels SET total_views = COALESCE(total_views, 0) + 1 WHERE id = _funnel_id;
$$;