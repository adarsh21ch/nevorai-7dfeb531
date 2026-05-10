-- Enterprise inquiries table for high-touch sales leads
CREATE TABLE public.enterprise_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  whatsapp_phone TEXT NOT NULL,
  email TEXT NOT NULL,
  network_name TEXT NOT NULL,
  team_size TEXT NOT NULL,
  platform TEXT,
  custom_needs TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  ip_address TEXT,
  user_agent TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  contacted_at TIMESTAMPTZ,
  CONSTRAINT enterprise_inquiries_status_check CHECK (status IN ('new','contacted','qualified','converted','rejected'))
);

CREATE INDEX idx_enterprise_inquiries_status ON public.enterprise_inquiries(status);
CREATE INDEX idx_enterprise_inquiries_submitted_at ON public.enterprise_inquiries(submitted_at DESC);

ALTER TABLE public.enterprise_inquiries ENABLE ROW LEVEL SECURITY;

-- Public can submit (form is unauthenticated)
CREATE POLICY "Anyone can submit enterprise inquiry"
ON public.enterprise_inquiries FOR INSERT
WITH CHECK (true);

-- Admins manage everything
CREATE POLICY "Admins manage enterprise inquiries"
ON public.enterprise_inquiries FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role full access
CREATE POLICY "Service role manages enterprise inquiries"
ON public.enterprise_inquiries FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Trigger to bump updated_at
CREATE TRIGGER tg_enterprise_inquiries_updated_at
BEFORE UPDATE ON public.enterprise_inquiries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();