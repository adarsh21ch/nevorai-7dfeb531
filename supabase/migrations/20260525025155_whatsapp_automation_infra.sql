-- ─── whatsapp_automation_log ──────────────────────────────────────
-- Idempotency tracking — ensures each user gets each automation at most once
-- per relevant period (e.g. one welcome_signup per user, one trial_ending per
-- trial cycle, etc.)

CREATE TABLE IF NOT EXISTS public.whatsapp_automation_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  automation_id   text NOT NULL,
  period_key      text NOT NULL,         -- e.g. trial cycle id, billing period id
                                         -- prevents re-sending within the same period
  sent_at         timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'sent',
  meta_message_id text,
  error_message   text,
  UNIQUE (user_id, automation_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_automation_log_user
  ON public.whatsapp_automation_log(user_id, automation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_automation_log_sent
  ON public.whatsapp_automation_log(sent_at DESC);

ALTER TABLE public.whatsapp_automation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read automation log" ON public.whatsapp_automation_log;
CREATE POLICY "Admins read automation log"
  ON public.whatsapp_automation_log FOR SELECT
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Service role manages automation log" ON public.whatsapp_automation_log;
CREATE POLICY "Service role manages automation log"
  ON public.whatsapp_automation_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── whatsapp_otp_codes ──────────────────────────────────────────
-- WhatsApp OTP verification for signup (phone-first auth).
-- Codes expire in 5 min. Max 5 attempts per code.

CREATE TABLE IF NOT EXISTS public.whatsapp_otp_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number    text NOT NULL,
  code_hash       text NOT NULL,         -- bcrypt-style hash, not plaintext
  expires_at      timestamptz NOT NULL,
  attempts        integer NOT NULL DEFAULT 0,
  verified        boolean NOT NULL DEFAULT false,
  user_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_phone_recent
  ON public.whatsapp_otp_codes(phone_number, created_at DESC);

ALTER TABLE public.whatsapp_otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages otp codes" ON public.whatsapp_otp_codes;
CREATE POLICY "Service role manages otp codes"
  ON public.whatsapp_otp_codes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── RPC: get users for each automation trigger ──────────────────
-- All these RPCs are STABLE — safe to call from edge functions.
-- They return users who SHOULD receive an automation TODAY but haven't yet.

-- 1. Trial ending soon: trial started 5 days ago and is still 'trial' status
CREATE OR REPLACE FUNCTION public.wa_users_trial_ending_soon()
RETURNS TABLE (user_id uuid, phone text, email text, full_name text, period_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT
    p.id,
    COALESCE(p.whatsapp_number, p.phone) AS phone,
    p.email,
    p.full_name,
    'trial_' || to_char(p.trial_start_date::date, 'YYYY_MM_DD') AS period_key
  FROM public.profiles p
  WHERE p.subscription_status = 'trial'
    AND p.trial_start_date IS NOT NULL
    AND (p.trial_start_date AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '5 days'
    AND COALESCE(p.whatsapp_number, p.phone) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.whatsapp_automation_log l
      WHERE l.user_id = p.id
        AND l.automation_id = 'trial_ending'
        AND l.period_key = 'trial_' || to_char(p.trial_start_date::date, 'YYYY_MM_DD')
    );
$$;

-- 2. Trial expired: trial started 7+ days ago, still 'trial' status (didn't upgrade)
CREATE OR REPLACE FUNCTION public.wa_users_trial_expired()
RETURNS TABLE (user_id uuid, phone text, email text, full_name text, period_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT
    p.id,
    COALESCE(p.whatsapp_number, p.phone),
    p.email,
    p.full_name,
    'trial_' || to_char(p.trial_start_date::date, 'YYYY_MM_DD')
  FROM public.profiles p
  WHERE p.subscription_status = 'trial'
    AND p.trial_start_date IS NOT NULL
    AND (p.trial_start_date AT TIME ZONE 'Asia/Kolkata')::date <= (now() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '7 days'
    AND COALESCE(p.whatsapp_number, p.phone) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.whatsapp_automation_log l
      WHERE l.user_id = p.id
        AND l.automation_id = 'trial_expired'
        AND l.period_key = 'trial_' || to_char(p.trial_start_date::date, 'YYYY_MM_DD')
    );
$$;

-- 3. Plan expiring soon: paid plan expires in 3 days
CREATE OR REPLACE FUNCTION public.wa_users_plan_expiring()
RETURNS TABLE (user_id uuid, phone text, email text, full_name text, period_key text, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT
    s.user_id,
    COALESCE(p.whatsapp_number, p.phone),
    p.email,
    p.full_name,
    'sub_' || s.id::text,
    s.expires_at
  FROM public.user_subscriptions s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.status = 'active'
    AND s.expires_at IS NOT NULL
    AND s.expires_at::date = (now() AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '3 days'
    AND COALESCE(p.whatsapp_number, p.phone) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.whatsapp_automation_log l
      WHERE l.user_id = s.user_id
        AND l.automation_id = 'plan_expiring'
        AND l.period_key = 'sub_' || s.id::text
    );
$$;

-- 4. Plan expired today (was active, now past expires_at)
CREATE OR REPLACE FUNCTION public.wa_users_plan_expired()
RETURNS TABLE (user_id uuid, phone text, email text, full_name text, period_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT
    s.user_id,
    COALESCE(p.whatsapp_number, p.phone),
    p.email,
    p.full_name,
    'sub_' || s.id::text
  FROM public.user_subscriptions s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.expires_at IS NOT NULL
    AND s.expires_at::date = (now() AT TIME ZONE 'Asia/Kolkata')::date
    AND COALESCE(p.whatsapp_number, p.phone) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.whatsapp_automation_log l
      WHERE l.user_id = s.user_id
        AND l.automation_id = 'plan_expired'
        AND l.period_key = 'sub_' || s.id::text
    );
$$;

-- 5. View limit 80% — check needs to be near-real-time (called from view increment RPC)
-- Skip a daily cron for this; the view-counter app code already knows when it crosses 80%.
-- We'll add a helper RPC the view counter can call directly to fire the automation safely.

-- 6. View limit 100% — same as above, fires on the 100% crossing event.

-- 7. Payment failed — fires from razorpay-webhook directly. No cron needed.

-- ─── profiles: phone_verified_at column ──────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

-- ─── Welcome on signup trigger ───────────────────────────────────
-- When a new profile is created, kick a fire-and-forget WhatsApp welcome.
-- Uses pg_net to call the whatsapp-send Edge Function.
-- Safely no-ops if pg_net isn't enabled OR if profile lacks phone.

CREATE OR REPLACE FUNCTION public.tg_profile_send_welcome_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp', 'net'
AS $$
DECLARE
  _phone text;
  _supabase_url text;
  _service_key text;
BEGIN
  _phone := COALESCE(NEW.whatsapp_number, NEW.phone);
  IF _phone IS NULL OR length(_phone) < 8 THEN RETURN NEW; END IF;

  -- Read project URL + service key from vault (safer than hardcoding).
  -- If vault entries aren't set, this trigger silently skips.
  BEGIN
    SELECT decrypted_secret INTO _supabase_url
      FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
    SELECT decrypted_secret INTO _service_key
      FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF _supabase_url IS NULL OR _service_key IS NULL THEN RETURN NEW; END IF;

  -- Best-effort fire (don't block signup if it fails)
  BEGIN
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/whatsapp-send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body := jsonb_build_object(
        'to', regexp_replace(_phone, '[^0-9]', '', 'g'),
        'automation_id', 'welcome_signup',
        'user_id', NEW.id::text,
        'variables', jsonb_build_object(
          'name', COALESCE(split_part(NEW.full_name, ' ', 1), 'there'),
          'email', COALESCE(NEW.email, '')
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- ignore — welcome is a nice-to-have, not critical
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_profile_send_welcome_whatsapp ON public.profiles;
CREATE TRIGGER tg_profile_send_welcome_whatsapp
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profile_send_welcome_whatsapp();
