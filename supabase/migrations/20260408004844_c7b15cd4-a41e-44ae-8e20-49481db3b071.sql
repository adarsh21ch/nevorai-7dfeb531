
-- ============================================
-- TABLE: landing_pages
-- ============================================
CREATE TABLE IF NOT EXISTS public.landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'draft',

  sections jsonb DEFAULT '[]',

  form_title text DEFAULT 'Register for the Session',
  form_subtitle text DEFAULT 'Fill in your details to secure your spot',
  form_button_text text DEFAULT 'Register Now',

  field_name_enabled boolean DEFAULT true,
  field_name_required boolean DEFAULT true,
  field_phone_enabled boolean DEFAULT true,
  field_phone_required boolean DEFAULT true,
  field_email_enabled boolean DEFAULT true,
  field_email_required boolean DEFAULT true,
  field_age_enabled boolean DEFAULT false,
  field_age_required boolean DEFAULT false,
  field_city_enabled boolean DEFAULT false,
  field_city_required boolean DEFAULT false,
  field_state_enabled boolean DEFAULT false,
  field_state_required boolean DEFAULT false,
  field_occupation_enabled boolean DEFAULT false,
  field_occupation_required boolean DEFAULT false,
  field_custom_1_enabled boolean DEFAULT false,
  field_custom_1_label text DEFAULT '',
  field_custom_1_required boolean DEFAULT false,
  field_custom_2_enabled boolean DEFAULT false,
  field_custom_2_label text DEFAULT '',
  field_custom_2_required boolean DEFAULT false,

  send_confirmation_email boolean DEFAULT true,
  email_subject text DEFAULT 'Your Registration is Confirmed!',
  email_heading text DEFAULT 'Welcome! You are registered.',
  email_body text DEFAULT 'Thank you for registering. We look forward to seeing you at the session.',
  email_footer_text text DEFAULT '',

  post_submit_video_asset_id uuid REFERENCES public.video_assets(id),
  post_submit_video_title text DEFAULT 'Watch this introduction',
  post_submit_video_description text DEFAULT '',

  linked_funnel_id uuid REFERENCES public.funnels(id),

  allow_login boolean DEFAULT true,
  allow_signup boolean DEFAULT true,
  invite_code_required boolean DEFAULT false,
  invite_code text,

  og_title text,
  og_description text,
  og_image_url text,

  total_views integer DEFAULT 0,
  total_registrations integer DEFAULT 0,

  theme_color text DEFAULT '#22c55e',
  background_style text DEFAULT 'dark',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_landing_pages_owner ON public.landing_pages(owner_id);
CREATE INDEX idx_landing_pages_slug ON public.landing_pages(slug);
CREATE INDEX idx_landing_pages_status ON public.landing_pages(status);

ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage_landing_pages" ON public.landing_pages
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "public_read_published_landing_pages" ON public.landing_pages
  FOR SELECT USING (status = 'published');

CREATE POLICY "admin_full_landing_pages" ON public.landing_pages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- TABLE: landing_page_registrations
-- ============================================
CREATE TABLE IF NOT EXISTS public.landing_page_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id),

  name text,
  phone text,
  email text,
  age text,
  city text,
  state text,
  occupation text,
  custom_1_value text,
  custom_2_value text,

  ip_address text,
  device_type text,
  user_agent text,
  referrer_url text,

  confirmation_email_sent boolean DEFAULT false,
  confirmation_email_sent_at timestamptz,

  video_started boolean DEFAULT false,
  video_watch_percentage numeric DEFAULT 0,
  video_completed boolean DEFAULT false,

  user_id uuid REFERENCES public.profiles(id),

  honeypot_triggered boolean DEFAULT false,

  submitted_at timestamptz DEFAULT now()
);

CREATE INDEX idx_lp_registrations_page ON public.landing_page_registrations(landing_page_id);
CREATE INDEX idx_lp_registrations_email ON public.landing_page_registrations(email);
CREATE INDEX idx_lp_registrations_submitted ON public.landing_page_registrations(submitted_at DESC);

ALTER TABLE public.landing_page_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_read_registrations" ON public.landing_page_registrations
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "owner_update_registrations" ON public.landing_page_registrations
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "public_insert_registration" ON public.landing_page_registrations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "admin_full_registrations" ON public.landing_page_registrations
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- TABLE: landing_page_view_logs
-- ============================================
CREATE TABLE IF NOT EXISTS public.landing_page_view_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  ip_address text,
  viewed_at timestamptz DEFAULT now()
);

CREATE INDEX idx_lp_views ON public.landing_page_view_logs(landing_page_id, viewed_at DESC);

ALTER TABLE public.landing_page_view_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_read_view_logs" ON public.landing_page_view_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.landing_pages
      WHERE landing_pages.id = landing_page_view_logs.landing_page_id
        AND landing_pages.owner_id = auth.uid()
    )
  );

CREATE POLICY "public_insert_view_logs" ON public.landing_page_view_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "admin_full_view_logs" ON public.landing_page_view_logs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- ALTER: funnel_steps — enhanced unlock system
-- ============================================
ALTER TABLE public.funnel_steps ADD COLUMN IF NOT EXISTS unlock_timer_minutes integer DEFAULT 0;
ALTER TABLE public.funnel_steps ADD COLUMN IF NOT EXISTS between_step_audio_url text;
ALTER TABLE public.funnel_steps ADD COLUMN IF NOT EXISTS between_step_message text DEFAULT '';
ALTER TABLE public.funnel_steps ADD COLUMN IF NOT EXISTS between_step_message_enabled boolean DEFAULT false;
ALTER TABLE public.funnel_steps ADD COLUMN IF NOT EXISTS between_step_audio_enabled boolean DEFAULT false;
ALTER TABLE public.funnel_steps ADD COLUMN IF NOT EXISTS unlock_after_percent integer DEFAULT 0;

-- ============================================
-- ALTER: funnel_step_progress — timer tracking
-- ============================================
ALTER TABLE public.funnel_step_progress ADD COLUMN IF NOT EXISTS unlock_scheduled_at timestamptz;

-- ============================================
-- Trigger for updated_at on landing_pages
-- ============================================
CREATE TRIGGER update_landing_pages_updated_at
  BEFORE UPDATE ON public.landing_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Increment view function
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_landing_page_views(_landing_page_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE landing_pages SET total_views = COALESCE(total_views, 0) + 1 WHERE id = _landing_page_id;
$$;
