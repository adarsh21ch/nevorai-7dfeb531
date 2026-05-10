
-- Plan config table
CREATE TABLE IF NOT EXISTS public.plan_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name text NOT NULL UNIQUE,
  monthly_price integer NOT NULL DEFAULT 0,
  yearly_price integer NOT NULL DEFAULT 0,
  yearly_validity_days integer NOT NULL DEFAULT 365,
  max_funnels integer NOT NULL DEFAULT 3,
  max_landing_pages integer NOT NULL DEFAULT 2,
  max_live_sessions integer NOT NULL DEFAULT 1,
  max_team_members integer NOT NULL DEFAULT 0,
  multilevel_funnel_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.plan_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read plan config"
  ON public.plan_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Anon can read plan config"
  ON public.plan_config FOR SELECT
  TO anon USING (true);

CREATE POLICY "Only admin can manage plan config"
  ON public.plan_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed defaults
INSERT INTO public.plan_config (plan_name, monthly_price, yearly_price, max_funnels, max_landing_pages, max_live_sessions, max_team_members, multilevel_funnel_enabled)
VALUES
  ('basic', 499, 2999, 3, 2, 1, 0, false),
  ('pro', 999, 5999, 10, 5, 5, 10, true)
ON CONFLICT (plan_name) DO NOTHING;

-- Team members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  UNIQUE(owner_id, member_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages team"
  ON public.team_members FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Member sees own row"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "Admin manages all teams"
  ON public.team_members FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Subscription logs table
CREATE TABLE IF NOT EXISTS public.subscription_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id),
  plan_tier text,
  plan_billing text,
  amount integer,
  razorpay_payment_id text,
  razorpay_subscription_id text,
  event_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscription_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert logs"
  ON public.subscription_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admin can read all logs"
  ON public.subscription_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own logs"
  ON public.subscription_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Add team_owner_id to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS team_owner_id uuid REFERENCES public.profiles(id);
