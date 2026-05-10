-- Create app_settings table for runtime config (trial settings, etc.)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (needed for landing page CTA text)
CREATE POLICY "Anyone can read app settings"
ON public.app_settings FOR SELECT
USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage app settings"
ON public.app_settings FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.app_settings (key, value) VALUES
  ('trial_enabled', 'true'),
  ('trial_days', '7')
ON CONFLICT (key) DO NOTHING;

-- Add trial columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_start_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial';

-- Backfill: existing profiles get trial_start_date = created_at
UPDATE public.profiles
SET trial_start_date = COALESCE(trial_start_date, created_at)
WHERE trial_start_date IS NULL;

-- Update handle_new_user to set trial_start_date for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, trial_start_date, subscription_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone),
    now(),
    'trial'
  );
  RETURN NEW;
END;
$function$;