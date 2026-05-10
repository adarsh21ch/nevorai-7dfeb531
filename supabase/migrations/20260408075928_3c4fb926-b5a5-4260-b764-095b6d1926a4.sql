ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS speaker_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS speaker_role text DEFAULT '',
  ADD COLUMN IF NOT EXISTS speaker_bio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS speaker_photo_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS sender_display_name text DEFAULT 'Nevorai Flow';