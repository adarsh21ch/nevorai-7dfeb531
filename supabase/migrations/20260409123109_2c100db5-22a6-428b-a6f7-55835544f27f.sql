
-- Create testimonials table
CREATE TABLE IF NOT EXISTS public.landing_page_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'text',
  student_name text NOT NULL,
  student_location text,
  student_photo_url text,
  review_text text,
  video_url text,
  thumbnail_url text,
  video_duration_seconds integer,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraint for type
ALTER TABLE public.landing_page_testimonials
  ADD CONSTRAINT landing_page_testimonials_type_check
  CHECK (type IN ('text', 'video'));

-- Index for efficient queries
CREATE INDEX idx_testimonials_landing_page ON public.landing_page_testimonials(landing_page_id, display_order);

-- Enable RLS
ALTER TABLE public.landing_page_testimonials ENABLE ROW LEVEL SECURITY;

-- Owner can manage their testimonials
CREATE POLICY "Owner manages testimonials"
  ON public.landing_page_testimonials FOR ALL
  USING (owner_id = auth.uid());

-- Public can read active testimonials for published landing pages
CREATE POLICY "Public can read active testimonials"
  ON public.landing_page_testimonials FOR SELECT
  USING (
    is_active = true AND
    landing_page_id IN (
      SELECT id FROM public.landing_pages WHERE status = 'published'
    )
  );

-- Add columns to landing_pages
ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS testimonials_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS testimonials_section_title text DEFAULT 'What our members say';

-- Add platform settings for testimonials
INSERT INTO public.platform_settings (key, value) VALUES
  ('testimonial_max_video_seconds', '60'),
  ('testimonial_max_per_page', '8'),
  ('testimonial_video_feature_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Updated_at trigger
CREATE TRIGGER update_testimonials_updated_at
  BEFORE UPDATE ON public.landing_page_testimonials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
