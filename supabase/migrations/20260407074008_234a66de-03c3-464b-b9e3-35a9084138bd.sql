
-- Payment audit logs for tracking all payment events
CREATE TABLE public.payment_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  razorpay_event_id text,
  razorpay_payment_id text,
  razorpay_order_id text,
  razorpay_subscription_id text,
  payload jsonb,
  source text NOT NULL DEFAULT 'webhook',
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs"
  ON public.payment_audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert audit logs"
  ON public.payment_audit_logs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_payment_audit_idempotency ON public.payment_audit_logs(idempotency_key);
CREATE INDEX idx_payment_audit_user ON public.payment_audit_logs(user_id);
CREATE INDEX idx_payment_audit_event ON public.payment_audit_logs(event_type);

-- Seed platform settings for Razorpay and support config
INSERT INTO public.platform_settings (key, value) VALUES
  ('support_whatsapp', '+919999999999'),
  ('support_message_template', 'Hi, I need help with my Nevorai Flow account.'),
  ('razorpay_monthly_price', '499'),
  ('razorpay_onetime_price', '2999'),
  ('razorpay_onetime_validity_days', '365'),
  ('razorpay_onetime_is_lifetime', 'false')
ON CONFLICT DO NOTHING;
