-- Per-user daily usage counter for Nev AI assistant
CREATE TABLE IF NOT EXISTS public.nev_ai_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

GRANT SELECT ON public.nev_ai_usage TO authenticated;
GRANT ALL ON public.nev_ai_usage TO service_role;

ALTER TABLE public.nev_ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own nev_ai_usage" ON public.nev_ai_usage;
CREATE POLICY "Users can read their own nev_ai_usage"
  ON public.nev_ai_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
