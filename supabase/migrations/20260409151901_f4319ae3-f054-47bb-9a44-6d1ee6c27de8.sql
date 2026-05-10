
ALTER TABLE public.landing_page_testimonials DROP CONSTRAINT IF EXISTS landing_page_testimonials_type_check;
ALTER TABLE public.landing_page_testimonials ADD CONSTRAINT landing_page_testimonials_type_check CHECK (type IN ('text', 'video', 'both'));
