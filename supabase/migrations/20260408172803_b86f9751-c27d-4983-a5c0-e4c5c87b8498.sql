
-- Add speaker fields to funnels table
ALTER TABLE public.funnels
  ADD COLUMN IF NOT EXISTS speaker_mode text NOT NULL DEFAULT 'account',
  ADD COLUMN IF NOT EXISTS speaker_name text,
  ADD COLUMN IF NOT EXISTS speaker_photo_url text,
  ADD COLUMN IF NOT EXISTS speaker_about text,
  ADD COLUMN IF NOT EXISTS video_topics_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_topics jsonb DEFAULT '[]'::jsonb;
