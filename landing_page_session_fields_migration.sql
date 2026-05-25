-- Adds new optional session/email-enrichment fields to landing_pages
-- and WhatsApp number + verification flag to profiles. Plus storage buckets.
-- Idempotent — safe to re-run.

ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS session_link TEXT,
  ADD COLUMN IF NOT EXISTS resource_link TEXT,
  ADD COLUMN IF NOT EXISTS email_banner_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS session_datetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS redirect_url TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN NOT NULL DEFAULT false;

-- Public buckets for landing page assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-page-banners', 'landing-page-banners', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-page-attachments', 'landing-page-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: public read, authenticated write
DO $$ BEGIN
  CREATE POLICY "Public can read landing-page-banners"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'landing-page-banners');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can upload landing-page-banners"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'landing-page-banners');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can update own landing-page-banners"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'landing-page-banners' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can delete own landing-page-banners"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'landing-page-banners' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public can read landing-page-attachments"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'landing-page-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can upload landing-page-attachments"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'landing-page-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can update own landing-page-attachments"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'landing-page-attachments' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can delete own landing-page-attachments"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'landing-page-attachments' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
