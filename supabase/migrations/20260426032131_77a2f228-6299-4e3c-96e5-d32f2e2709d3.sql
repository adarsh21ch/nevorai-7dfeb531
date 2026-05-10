ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS min_age_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_age integer NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS access_code_hash text,
  ADD COLUMN IF NOT EXISTS access_code_message text,
  ADD COLUMN IF NOT EXISTS testimonials_display_position text NOT NULL DEFAULT 'after_registration',
  ADD COLUMN IF NOT EXISTS faq_items jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Validation trigger (cannot use CHECK with mutable values, but these are constants, still using trigger to match project conventions)
CREATE OR REPLACE FUNCTION public.tg_landing_page_validate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.testimonials_display_position NOT IN ('before_registration', 'after_registration', 'both') THEN
    RAISE EXCEPTION 'invalid testimonials_display_position: %', NEW.testimonials_display_position;
  END IF;
  IF NEW.min_age IS NOT NULL AND (NEW.min_age < 0 OR NEW.min_age > 120) THEN
    RAISE EXCEPTION 'min_age out of range: %', NEW.min_age;
  END IF;
  -- Cap faq_items at 10 server-side as defense in depth
  IF jsonb_typeof(NEW.faq_items) = 'array' AND jsonb_array_length(NEW.faq_items) > 10 THEN
    RAISE EXCEPTION 'faq_items cannot exceed 10 entries';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS landing_page_validate_trigger ON public.landing_pages;
CREATE TRIGGER landing_page_validate_trigger
  BEFORE INSERT OR UPDATE ON public.landing_pages
  FOR EACH ROW EXECUTE FUNCTION public.tg_landing_page_validate();