-- Run this once to allow creators to hide the upload date on /v/{slug}.
-- Apply via the Supabase SQL editor.
ALTER TABLE public.video_assets
  ADD COLUMN IF NOT EXISTS show_upload_date boolean NOT NULL DEFAULT true;
