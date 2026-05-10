
-- Allow public users to update their own progress rows (by session_id match)
CREATE POLICY "Anyone can update own step progress"
ON public.funnel_step_progress FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM funnels
    WHERE funnels.id = funnel_step_progress.funnel_id
    AND funnels.is_published = true
  )
);
