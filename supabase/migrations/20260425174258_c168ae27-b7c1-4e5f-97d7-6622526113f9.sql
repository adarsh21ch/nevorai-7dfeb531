
ALTER TABLE public.funnel_steps
  ADD COLUMN IF NOT EXISTS unlock_condition text DEFAULT 'full_watch',
  ADD COLUMN IF NOT EXISTS unlock_percentage integer DEFAULT 80,
  ADD COLUMN IF NOT EXISTS time_delay_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_delay_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timer_cta_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS timer_cta_text text,
  ADD COLUMN IF NOT EXISTS timer_cta_url text,
  ADD COLUMN IF NOT EXISTS timer_cta_style text DEFAULT 'gold',
  ADD COLUMN IF NOT EXISTS video_topics_step_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_topics_step jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS access_code_hash text,
  ADD COLUMN IF NOT EXISTS access_code_message text;

ALTER TABLE public.funnels
  ADD COLUMN IF NOT EXISTS speaker_scope text DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS video_topics_scope text DEFAULT 'global';
