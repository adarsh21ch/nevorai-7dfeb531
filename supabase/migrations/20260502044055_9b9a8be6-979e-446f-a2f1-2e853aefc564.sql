ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS repeat_type text NOT NULL DEFAULT 'once',
  ADD COLUMN IF NOT EXISTS repeat_interval_hours integer,
  ADD COLUMN IF NOT EXISTS repeat_window_start time,
  ADD COLUMN IF NOT EXISTS repeat_window_end time,
  ADD COLUMN IF NOT EXISTS repeat_end_date date,
  ADD COLUMN IF NOT EXISTS replay_delay_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replay_expires_hours integer,
  ADD COLUMN IF NOT EXISTS replay_per_slot boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS total_views integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peak_concurrent integer NOT NULL DEFAULT 0;

-- Validation trigger for repeat_type and interval bounds
CREATE OR REPLACE FUNCTION public.tg_live_sessions_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.repeat_type NOT IN ('once','daily','interval','custom') THEN
    RAISE EXCEPTION 'invalid repeat_type: %', NEW.repeat_type;
  END IF;
  IF NEW.repeat_type = 'interval' THEN
    IF NEW.repeat_interval_hours IS NULL OR NEW.repeat_interval_hours < 1 OR NEW.repeat_interval_hours > 24 THEN
      RAISE EXCEPTION 'repeat_interval_hours must be between 1 and 24';
    END IF;
  END IF;
  IF NEW.replay_delay_minutes < 0 OR NEW.replay_delay_minutes > 100000 THEN
    RAISE EXCEPTION 'replay_delay_minutes out of range';
  END IF;
  IF NEW.replay_expires_hours IS NOT NULL AND NEW.replay_expires_hours < 1 THEN
    RAISE EXCEPTION 'replay_expires_hours must be >= 1 or null';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS live_sessions_validate ON public.live_sessions;
CREATE TRIGGER live_sessions_validate
  BEFORE INSERT OR UPDATE ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_live_sessions_validate();

-- Allow 'cancelled' status via the existing public read policy
DROP POLICY IF EXISTS "Anyone can view published sessions" ON public.live_sessions;
CREATE POLICY "Anyone can view published sessions"
  ON public.live_sessions
  FOR SELECT
  USING (status IN ('scheduled','live','ended','cancelled') AND is_published = true);