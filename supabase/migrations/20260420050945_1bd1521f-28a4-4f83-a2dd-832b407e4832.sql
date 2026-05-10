-- Create refund_requests table for 7-day money-back guarantee
CREATE TABLE public.refund_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID,
  payment_id TEXT,
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_refund_requests_user_id ON public.refund_requests(user_id);
CREATE INDEX idx_refund_requests_status ON public.refund_requests(status);
CREATE INDEX idx_refund_requests_requested_at ON public.refund_requests(requested_at DESC);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

-- Users see and create their own requests
CREATE POLICY "Users can view own refund requests"
  ON public.refund_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can submit refund requests"
  ON public.refund_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins manage all
CREATE POLICY "Admins manage refund requests"
  ON public.refund_requests FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Service role manages all (for edge function)
CREATE POLICY "Service role manages refund requests"
  ON public.refund_requests FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Updated-at trigger
CREATE TRIGGER update_refund_requests_updated_at
  BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();