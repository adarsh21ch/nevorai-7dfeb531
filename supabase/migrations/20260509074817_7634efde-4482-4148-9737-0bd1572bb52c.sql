ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS templates jsonb NOT NULL DEFAULT '[]'::jsonb;