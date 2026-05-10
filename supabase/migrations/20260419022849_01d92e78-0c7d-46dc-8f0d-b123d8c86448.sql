-- Enterprise plan configuration (singleton row, id = 1)
CREATE TABLE IF NOT EXISTS public.enterprise_plan_config (
  id integer PRIMARY KEY DEFAULT 1,
  badge_text text NOT NULL DEFAULT 'For Large Networks',
  subheading text NOT NULL DEFAULT '100+ active team members',
  monthly_price integer NOT NULL DEFAULT 5999,
  price_note text NOT NULL DEFAULT 'Custom pricing based on scope',
  setup_fee_note text NOT NULL DEFAULT '+ One-time setup fee applies',
  show_setup_fee_note boolean NOT NULL DEFAULT true,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_text text NOT NULL DEFAULT 'Book a Call',
  is_visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT enterprise_plan_config_singleton CHECK (id = 1)
);

ALTER TABLE public.enterprise_plan_config ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can read the Enterprise card config
CREATE POLICY "Anyone can read enterprise plan config"
  ON public.enterprise_plan_config
  FOR SELECT
  USING (true);

-- Admins can manage it from the admin panel
CREATE POLICY "Admins manage enterprise plan config"
  ON public.enterprise_plan_config
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Service role bypass for edge functions / admin tooling
CREATE POLICY "Service role manages enterprise plan config"
  ON public.enterprise_plan_config
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.tg_enterprise_plan_config_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enterprise_plan_config_updated_at ON public.enterprise_plan_config;
CREATE TRIGGER trg_enterprise_plan_config_updated_at
BEFORE UPDATE ON public.enterprise_plan_config
FOR EACH ROW
EXECUTE FUNCTION public.tg_enterprise_plan_config_updated_at();

-- Seed the singleton row with production defaults
INSERT INTO public.enterprise_plan_config (id, features)
VALUES (
  1,
  '[
    { "text": "Unlimited funnels", "enabled": true },
    { "text": "Unlimited landing pages", "enabled": true },
    { "text": "Unlimited live sessions", "enabled": true },
    { "text": "Unlimited video uploads", "enabled": true },
    { "text": "Unlimited team members", "enabled": true },
    { "text": "Your own white-label branded app", "enabled": true },
    { "text": "Custom features for your network", "enabled": true },
    { "text": "Dedicated onboarding support", "enabled": true },
    { "text": "Direct WhatsApp support line", "enabled": true },
    { "text": "Custom domain for your app", "enabled": true },
    { "text": "Team admin dashboard", "enabled": true },
    { "text": "Priority feature requests", "enabled": true },
    { "text": "Everything in Pro plan included", "enabled": true }
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;