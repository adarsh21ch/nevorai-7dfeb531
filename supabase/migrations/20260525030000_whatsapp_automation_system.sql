-- WhatsApp Automation System: templates, automations, steps, sequence enrollments, campaigns
-- Idempotent: safe to re-run.

-- ============================================================
-- 1. whatsapp_templates
-- ============================================================
create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  media_key text,
  category text not null check (category in ('nurture','onboarding','retention','broadcast','support')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.whatsapp_templates enable row level security;

drop policy if exists "admins manage templates" on public.whatsapp_templates;
create policy "admins manage templates" on public.whatsapp_templates
  for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2. whatsapp_automations
-- ============================================================
create table if not exists public.whatsapp_automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  trigger_event text not null check (trigger_event in (
    'funnel_lead_captured','user_signup','subscribed',
    'trial_day1','trial_day3','trial_day5','trial_day7',
    'no_subscription_7d','plan_expiring_3d','plan_expired'
  )),
  is_active boolean not null default false,
  total_enrolled int not null default 0,
  total_converted int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.whatsapp_automations enable row level security;

drop policy if exists "admins manage automations" on public.whatsapp_automations;
create policy "admins manage automations" on public.whatsapp_automations
  for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 3. whatsapp_automation_steps
-- ============================================================
create table if not exists public.whatsapp_automation_steps (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.whatsapp_automations(id) on delete cascade,
  step_order int not null,
  delay_hours int not null default 0,
  template_id uuid references public.whatsapp_templates(id) on delete set null,
  stop_if_subscribed boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_automation_steps_automation
  on public.whatsapp_automation_steps(automation_id, step_order);

alter table public.whatsapp_automation_steps enable row level security;

drop policy if exists "admins manage automation steps" on public.whatsapp_automation_steps;
create policy "admins manage automation steps" on public.whatsapp_automation_steps
  for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 4. whatsapp_sequence_enrollments
-- ============================================================
create table if not exists public.whatsapp_sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  user_id uuid references public.profiles(id) on delete set null,
  automation_id uuid not null references public.whatsapp_automations(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  current_step int not null default 0,
  next_send_at timestamptz not null,
  status text not null default 'active' check (status in ('active','paused','completed','converted','unsubscribed')),
  completed_at timestamptz,
  unique (phone_number, automation_id)
);

create index if not exists idx_whatsapp_enrollments_due
  on public.whatsapp_sequence_enrollments(status, next_send_at);

alter table public.whatsapp_sequence_enrollments enable row level security;

drop policy if exists "admins read enrollments" on public.whatsapp_sequence_enrollments;
create policy "admins read enrollments" on public.whatsapp_sequence_enrollments
  for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 5. whatsapp_campaigns
-- ============================================================
create table if not exists public.whatsapp_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_id uuid references public.whatsapp_templates(id) on delete set null,
  target_segment text not null check (target_segment in ('all','trial','free','basic','pro','no_subscription')),
  scheduled_at timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent','failed')),
  sent_count int not null default 0,
  failed_count int not null default 0,
  total_audience int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.whatsapp_campaigns enable row level security;

drop policy if exists "admins manage campaigns" on public.whatsapp_campaigns;
create policy "admins manage campaigns" on public.whatsapp_campaigns
  for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- SEED DATA — templates
-- ============================================================
insert into public.whatsapp_templates (name, body, category) values
('Welcome - Funnel Lead', 'Hi {{name}}! 👋 Thanks for your interest in Nevorai.

We help creators and business owners share video presentations and capture leads — all in one link.

🎯 Start your free trial here: {{link}}

Any questions? Just reply here.', 'nurture'),
('Day 1 - Feature Highlight', 'Hi {{name}}, quick tip! 💡

With Nevorai, you can:
✅ Upload your video
✅ Add a lead capture form
✅ Share one link — that''s your funnel

Takes under 5 minutes to set up: {{link}}

Want me to walk you through it?', 'nurture'),
('Day 3 - Social Proof', 'Hi {{name}}! 🙌

Creators using Nevorai are capturing leads directly from their video — no more chasing people on WhatsApp groups.

See how it works: {{link}}

Your free trial is waiting. Give it a try today.', 'nurture'),
('Trial Ending - Day 5', 'Hi {{name}}, your Nevorai free trial ends in {{days_left}} days. ⏳

Don''t lose access to your funnels and leads.

👉 Upgrade here: {{link}}

Basic starts at just ₹149/month.', 'retention'),
('Welcome After Subscription', '🎉 Welcome to Nevorai, {{name}}!

You''re on the {{plan}} plan. Here''s your first step:

1️⃣ Upload your first video
2️⃣ Create a funnel
3️⃣ Share the link and start getting leads

Go to your dashboard: {{link}}

Any help needed? Just reply here!', 'onboarding'),
('Plan Expiring Soon', 'Hi {{name}}, your {{plan}} plan expires on {{expiry}}. 📅

Renew now to keep your funnels live and leads flowing.

🔄 Renew here: {{link}}

Need help? Just reply.', 'retention')
on conflict do nothing;

-- ============================================================
-- SEED DATA — automations + steps
-- ============================================================
do $$
declare
  v_nurture_id uuid;
  v_onboard_id uuid;
  v_t1 uuid; v_t2 uuid; v_t3 uuid; v_t4 uuid; v_t5 uuid;
begin
  select id into v_t1 from public.whatsapp_templates where name = 'Welcome - Funnel Lead' limit 1;
  select id into v_t2 from public.whatsapp_templates where name = 'Day 1 - Feature Highlight' limit 1;
  select id into v_t3 from public.whatsapp_templates where name = 'Day 3 - Social Proof' limit 1;
  select id into v_t4 from public.whatsapp_templates where name = 'Trial Ending - Day 5' limit 1;
  select id into v_t5 from public.whatsapp_templates where name = 'Welcome After Subscription' limit 1;

  -- Automation 1
  select id into v_nurture_id from public.whatsapp_automations where name = 'Funnel Lead Nurture' limit 1;
  if v_nurture_id is null then
    insert into public.whatsapp_automations (name, description, trigger_event, is_active)
    values ('Funnel Lead Nurture', 'Nurture sequence for new funnel leads', 'funnel_lead_captured', false)
    returning id into v_nurture_id;

    insert into public.whatsapp_automation_steps (automation_id, step_order, delay_hours, template_id, stop_if_subscribed) values
      (v_nurture_id, 1, 0,   v_t1, true),
      (v_nurture_id, 2, 24,  v_t2, true),
      (v_nurture_id, 3, 72,  v_t3, true),
      (v_nurture_id, 4, 120, v_t4, true);
  end if;

  -- Automation 2
  select id into v_onboard_id from public.whatsapp_automations where name = 'Post-Subscription Onboarding' limit 1;
  if v_onboard_id is null then
    insert into public.whatsapp_automations (name, description, trigger_event, is_active)
    values ('Post-Subscription Onboarding', 'First message after a user subscribes', 'subscribed', false)
    returning id into v_onboard_id;

    insert into public.whatsapp_automation_steps (automation_id, step_order, delay_hours, template_id, stop_if_subscribed) values
      (v_onboard_id, 1, 0, v_t5, false);
  end if;
end $$;
