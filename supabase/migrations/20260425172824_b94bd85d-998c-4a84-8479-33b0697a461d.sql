ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS field_dob_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS field_dob_required boolean NOT NULL DEFAULT false;