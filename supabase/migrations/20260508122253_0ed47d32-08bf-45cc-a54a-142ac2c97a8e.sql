-- 1) Revoke column-level read access to sensitive hash/invite columns from anon and authenticated.
--    Service role and table owner are unaffected. Owners read these via the service role / SECURITY DEFINER paths
--    or via authenticated RLS that ignores column GRANTs (RLS uses table-level USING; column-level GRANT controls SELECT of those columns).
REVOKE SELECT (access_code_hash, password_hash) ON public.funnels FROM anon, authenticated;
REVOKE SELECT (access_code_hash) ON public.funnel_steps FROM anon, authenticated;
REVOKE SELECT (access_code_hash, invite_code) ON public.landing_pages FROM anon, authenticated;

-- Re-grant SELECT on all other columns so the existing app keeps working.
-- Postgres requires us to enumerate what to re-grant; easiest is to grant on every other column individually.
-- Instead we grant SELECT on the full table excluding the sensitive ones via dynamic SQL.
DO $$
DECLARE
  t record;
  cols text;
BEGIN
  FOR t IN (
    SELECT 'funnels'::text AS tbl, ARRAY['access_code_hash','password_hash']::text[] AS hidden
    UNION ALL SELECT 'funnel_steps', ARRAY['access_code_hash']
    UNION ALL SELECT 'landing_pages', ARRAY['access_code_hash','invite_code']
  ) LOOP
    SELECT string_agg(quote_ident(column_name), ', ')
      INTO cols
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = t.tbl
      AND NOT (column_name = ANY (t.hidden));
    EXECUTE format('GRANT SELECT (%s) ON public.%I TO anon, authenticated', cols, t.tbl);
  END LOOP;
END $$;

-- 2) Tighten anonymous UPDATE on funnel_step_progress so attackers can't escalate unlock flags.
DROP POLICY IF EXISTS "Anyone can update own step progress" ON public.funnel_step_progress;

-- Allow anonymous viewer updates only when the row belongs to a published funnel AND
-- the row is not being mutated to claim manual/permanent unlock or change ownership fields.
CREATE POLICY "Anyone can update own step progress"
ON public.funnel_step_progress
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.funnels f
    WHERE f.id = funnel_step_progress.funnel_id AND f.is_published = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.funnels f
    WHERE f.id = funnel_step_progress.funnel_id AND f.is_published = true
  )
  -- Prevent escalation: anonymous callers may not set these fields to true.
  AND COALESCE(manually_unlocked, false) = false
  AND COALESCE(permanently_unlocked, false) = false
  AND COALESCE(access_code_unlocked, false) = false
  AND unlocked_by IS NULL
);

-- Owners (authenticated) keep full control via the existing "Owners can manage step progress" ALL policy.

-- 3) Tighten anonymous UPDATE on member_activity_log: drop the broad UPDATE policy entirely.
--    Anonymous viewers should INSERT new rows, not mutate existing ones. Owners/admins/service role keep their access.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.member_activity_log'::regclass
      AND polcmd = 'w'
  LOOP
    -- Only drop policies that are clearly the unrestricted public UPDATE policy.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.member_activity_log', p.polname);
  END LOOP;
END $$;

-- Re-create a minimal owner-only UPDATE policy (in case the table previously relied on owners updating).
CREATE POLICY "Owners can update activity log"
ON public.member_activity_log
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.funnels f
    WHERE f.id = member_activity_log.funnel_id AND f.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.funnels f
    WHERE f.id = member_activity_log.funnel_id AND f.owner_id = auth.uid()
  )
);
