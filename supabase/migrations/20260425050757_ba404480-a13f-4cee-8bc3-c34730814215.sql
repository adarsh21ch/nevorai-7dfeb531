-- Create admin audit logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NOT NULL,
  admin_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user_id ON public.admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON public.admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view audit logs (for transparency and review)
CREATE POLICY "Admins can view all audit logs"
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- NOTE: No INSERT/UPDATE/DELETE policies are defined.
-- This means only the service role (edge functions / trusted server code) can write records.
-- Admins cannot tamper with their own audit trail through the app.

-- Helper SECURITY DEFINER function for edge functions to log actions safely
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _admin_user_id uuid,
  _action text,
  _target_type text DEFAULT NULL,
  _target_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _ip_address text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _log_id uuid;
  _admin_email text;
BEGIN
  -- Verify the actor is actually an admin (defense in depth)
  IF NOT public.has_role(_admin_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'log_admin_action: user % is not an admin', _admin_user_id;
  END IF;

  -- Resolve admin email for easier querying
  SELECT email INTO _admin_email FROM public.profiles WHERE id = _admin_user_id;

  INSERT INTO public.admin_audit_logs (
    admin_user_id, admin_email, action, target_type, target_id, metadata, ip_address, user_agent
  )
  VALUES (
    _admin_user_id, _admin_email, _action, _target_type, _target_id, COALESCE(_metadata, '{}'::jsonb), _ip_address, _user_agent
  )
  RETURNING id INTO _log_id;

  RETURN _log_id;
END;
$$;