
-- Add funnel mode column
ALTER TABLE public.funnels ADD COLUMN IF NOT EXISTS funnel_mode text NOT NULL DEFAULT 'single';

-- Create funnel_steps table
CREATE TABLE public.funnel_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id uuid NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 0,
  title text NOT NULL DEFAULT '',
  description text,
  step_type text NOT NULL DEFAULT 'video',
  video_asset_id uuid REFERENCES public.video_assets(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  unlock_rule_type text NOT NULL DEFAULT 'auto',
  unlock_rule_value text,
  cta_text text,
  cta_url text,
  booking_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_funnel_steps_funnel_id ON public.funnel_steps(funnel_id);
CREATE INDEX idx_funnel_steps_order ON public.funnel_steps(funnel_id, step_order);

-- Enable RLS
ALTER TABLE public.funnel_steps ENABLE ROW LEVEL SECURITY;

-- Owners can manage their funnel steps
CREATE POLICY "Owners can manage funnel steps"
ON public.funnel_steps FOR ALL
USING (EXISTS (SELECT 1 FROM funnels WHERE funnels.id = funnel_steps.funnel_id AND funnels.owner_id = auth.uid()));

-- Anyone can view steps of published funnels
CREATE POLICY "Anyone can view published funnel steps"
ON public.funnel_steps FOR SELECT
USING (EXISTS (SELECT 1 FROM funnels WHERE funnels.id = funnel_steps.funnel_id AND funnels.is_published = true));

-- Updated_at trigger
CREATE TRIGGER update_funnel_steps_updated_at
BEFORE UPDATE ON public.funnel_steps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create funnel_step_progress table
CREATE TABLE public.funnel_step_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id uuid NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  funnel_step_id uuid NOT NULL REFERENCES public.funnel_steps(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.funnel_leads(id) ON DELETE CASCADE,
  session_id text,
  status text NOT NULL DEFAULT 'locked',
  max_watched_seconds integer DEFAULT 0,
  watched_percentage integer DEFAULT 0,
  last_position_seconds integer DEFAULT 0,
  completed_at timestamptz,
  manually_unlocked boolean DEFAULT false,
  unlocked_by uuid,
  unlocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_step_progress_funnel ON public.funnel_step_progress(funnel_id);
CREATE INDEX idx_step_progress_lead ON public.funnel_step_progress(lead_id);
CREATE INDEX idx_step_progress_step ON public.funnel_step_progress(funnel_step_id);
CREATE UNIQUE INDEX idx_step_progress_unique ON public.funnel_step_progress(funnel_step_id, lead_id);

-- Enable RLS
ALTER TABLE public.funnel_step_progress ENABLE ROW LEVEL SECURITY;

-- Anyone can insert progress for published funnels
CREATE POLICY "Anyone can submit step progress"
ON public.funnel_step_progress FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM funnels WHERE funnels.id = funnel_step_progress.funnel_id AND funnels.is_published = true));

-- Anyone can view progress by session
CREATE POLICY "Anyone can view own progress"
ON public.funnel_step_progress FOR SELECT
USING (true);

-- Owners can view and update progress for their funnels
CREATE POLICY "Owners can manage step progress"
ON public.funnel_step_progress FOR ALL
USING (EXISTS (SELECT 1 FROM funnels WHERE funnels.id = funnel_step_progress.funnel_id AND funnels.owner_id = auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_step_progress_updated_at
BEFORE UPDATE ON public.funnel_step_progress
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
