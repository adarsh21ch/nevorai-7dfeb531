CREATE TABLE public.gmail_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  gmail_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gmail_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage gmail tokens"
ON public.gmail_oauth_tokens
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');