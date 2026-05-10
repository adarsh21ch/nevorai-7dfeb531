-- Update the public view policy to also allow password-protected published funnels
DROP POLICY IF EXISTS "Anyone can view published funnels" ON public.funnels;
CREATE POLICY "Anyone can view published funnels"
ON public.funnels
FOR SELECT
USING (is_published = true);