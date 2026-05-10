
-- 1. Singleton settings table for the Nevorai Pro gateway
CREATE TABLE IF NOT EXISTS public.member_gateway_settings (
  id integer PRIMARY KEY DEFAULT 1,
  gateway_enabled boolean NOT NULL DEFAULT true,
  access_duration_type text NOT NULL DEFAULT 'continuous'
    CHECK (access_duration_type IN ('continuous', 'days', 'disabled')),
  access_duration_days integer,
  notify_enabled boolean NOT NULL DEFAULT true,
  notify_in_app boolean NOT NULL DEFAULT true,
  notify_email boolean NOT NULL DEFAULT true,
  notify_whatsapp boolean NOT NULL DEFAULT false,
  notification_template text NOT NULL DEFAULT
    'Hi {{name}},\n\nAs a Nevorai Pro member, you now have free access to nFlow Individual plan.\n\nYou can create video funnels, capture leads, and track your prospects — at no extra cost.\n\nClick here to activate: {{login_url}}\n\n— Team Nevorai',
  last_check_at timestamptz,
  last_check_summary jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT singleton_row CHECK (id = 1)
);

ALTER TABLE public.member_gateway_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage gateway settings"
  ON public.member_gateway_settings
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages gateway settings"
  ON public.member_gateway_settings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Anyone authenticated can read gateway settings"
  ON public.member_gateway_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Seed the singleton row
INSERT INTO public.member_gateway_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 2. Extend profiles with member-lifecycle fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nevorai_member_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS nevorai_member_notified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nevorai_member_notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS nevorai_member_status text NOT NULL DEFAULT 'inactive'
    CHECK (nevorai_member_status IN ('inactive', 'active', 'paused', 'expired', 'revoked'));

CREATE INDEX IF NOT EXISTS idx_profiles_nevorai_member_active
  ON public.profiles (nevorai_member_active)
  WHERE nevorai_member_active = true;

CREATE INDEX IF NOT EXISTS idx_profiles_nevorai_member_expires_at
  ON public.profiles (nevorai_member_expires_at)
  WHERE nevorai_member_expires_at IS NOT NULL;

-- 3. Trigger to keep updated_at fresh on settings
CREATE OR REPLACE FUNCTION public.tg_member_gateway_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_gateway_settings_set_updated_at ON public.member_gateway_settings;
CREATE TRIGGER member_gateway_settings_set_updated_at
  BEFORE UPDATE ON public.member_gateway_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_member_gateway_settings_updated_at();
