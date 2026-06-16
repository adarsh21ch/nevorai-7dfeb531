-- Creator identity + verification (Part A–F of Nevorai watch-page spec)
-- Adds public-creator columns to profiles, a public read view (safe columns
-- only), KYC→is_verified linkage, and the address/display_name fields used by
-- the Profile editor.
--
-- Apply via: supabase db push  OR  psql $DATABASE_URL -f creator_identity_verification_migration.sql

------------------------------------------------------------------------------
-- 1. profiles columns
------------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS username     text,
  ADD COLUMN IF NOT EXISTS address      text,
  ADD COLUMN IF NOT EXISTS cta_label    text,
  ADD COLUMN IF NOT EXISTS cta_url      text,
  ADD COLUMN IF NOT EXISTS is_verified  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at  timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by  uuid REFERENCES auth.users(id);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

------------------------------------------------------------------------------
-- 2. Block users from self-granting is_verified / verified_at / verified_by.
--    Existing "Users can update own profile" policy lets the owner UPDATE
--    their row; this trigger silently reverts attempts to flip the
--    verification columns unless the caller is an admin or service role.
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_verification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'UPDATE')
     AND (NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
       OR NEW.verified_by IS DISTINCT FROM OLD.verified_by)
     AND NOT public.has_role(auth.uid(), 'admin')
     AND auth.role() <> 'service_role'
  THEN
    NEW.is_verified := OLD.is_verified;
    NEW.verified_at := OLD.verified_at;
    NEW.verified_by := OLD.verified_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_verification ON public.profiles;
CREATE TRIGGER guard_profile_verification
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_verification();

------------------------------------------------------------------------------
-- 3. Public read view — exposes ONLY safe creator fields.
--    Views run as their owner (definer) by default, so anon/auth can read
--    these columns without widening RLS on public.profiles.
------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.profiles_public AS
  SELECT
    id,
    COALESCE(NULLIF(display_name, ''), NULLIF(full_name, ''), split_part(email, '@', 1)) AS display_name,
    avatar_url,
    is_verified,
    username,
    cta_label,
    cta_url
  FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

------------------------------------------------------------------------------
-- 4. KYC approval → blue tick. Admin-only RPC sets is_verified atomically.
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_review_kyc(
  _submission_id uuid,
  _action        text,          -- 'approved' | 'rejected'
  _reason        text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_id uuid;
  _admin   uuid := auth.uid();
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _action NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  UPDATE public.user_kyc_submissions
     SET status            = _action,
         reviewed_at       = now(),
         rejection_reason  = CASE WHEN _action = 'rejected' THEN _reason ELSE NULL END
   WHERE id = _submission_id
   RETURNING user_id INTO _user_id;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'submission not found';
  END IF;

  IF _action = 'approved' THEN
    UPDATE public.profiles
       SET kyc_status      = 'verified',
           kyc_verified_at = now(),
           is_verified     = true,
           verified_at     = now(),
           verified_by     = _admin
     WHERE id = _user_id;
  ELSE
    UPDATE public.profiles
       SET kyc_status      = 'rejected',
           kyc_verified_at = NULL
     WHERE id = _user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_kyc(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_kyc(uuid, text, text) TO authenticated;
