-- Enable "YouTube Video Import" feature for all plans (Free, Basic, Pro).
-- The column already exists in plan_config.
-- Run this once in the Supabase SQL editor.

UPDATE public.plan_config
   SET feature_youtube_import = true
 WHERE plan_name IN ('free', 'basic', 'pro');
