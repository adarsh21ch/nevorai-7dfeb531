
-- Drop and recreate the owner policy with explicit WITH CHECK
DROP POLICY IF EXISTS "Owner manages testimonials" ON public.landing_page_testimonials;

CREATE POLICY "Owner manages testimonials"
  ON public.landing_page_testimonials
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
