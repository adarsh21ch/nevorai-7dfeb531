ALTER TABLE public.video_assets
ADD COLUMN IF NOT EXISTS allow_copy_link boolean NOT NULL DEFAULT true;