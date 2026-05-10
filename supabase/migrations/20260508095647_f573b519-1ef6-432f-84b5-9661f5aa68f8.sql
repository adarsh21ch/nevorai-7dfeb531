
CREATE POLICY "Anyone can view own progress" ON public.funnel_step_progress
  FOR SELECT USING (true);
CREATE POLICY "Anyone can view own activity" ON public.member_activity_log
  FOR SELECT USING (true);
