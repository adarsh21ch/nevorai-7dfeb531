CREATE TABLE IF NOT EXISTS public.member_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id uuid NOT NULL,
  lead_id uuid,
  session_id text,
  activity_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  videos_watched integer NOT NULL DEFAULT 0,
  steps_completed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS member_activity_log_unique
  ON public.member_activity_log (funnel_id, COALESCE(lead_id::text, ''), COALESCE(session_id, ''), activity_date);

CREATE INDEX IF NOT EXISTS member_activity_log_lookup
  ON public.member_activity_log (funnel_id, lead_id, session_id);

ALTER TABLE public.member_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert own activity"
  ON public.member_activity_log
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.funnels WHERE funnels.id = member_activity_log.funnel_id AND funnels.is_published = true)
  );

CREATE POLICY "Anyone can update own activity"
  ON public.member_activity_log
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.funnels WHERE funnels.id = member_activity_log.funnel_id AND funnels.is_published = true)
  );

CREATE POLICY "Anyone can view own activity"
  ON public.member_activity_log
  FOR SELECT
  USING (true);

CREATE POLICY "Owners view all funnel activity"
  ON public.member_activity_log
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.funnels WHERE funnels.id = member_activity_log.funnel_id AND funnels.owner_id = auth.uid())
  );

CREATE POLICY "Admins view all activity"
  ON public.member_activity_log
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER member_activity_log_updated_at
  BEFORE UPDATE ON public.member_activity_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();