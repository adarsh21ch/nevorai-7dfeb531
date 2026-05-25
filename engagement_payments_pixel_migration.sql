-- Funnel engagement events + Razorpay/Meta-Pixel admin-editable settings.
-- Run this in Supabase SQL Editor. Idempotent.

-- ============================================================
-- 0. Extend whatsapp_automations.trigger_event to include new triggers
-- ============================================================
do $$
begin
  alter table public.whatsapp_automations
    drop constraint if exists whatsapp_automations_trigger_event_check;
  alter table public.whatsapp_automations
    add constraint whatsapp_automations_trigger_event_check check (trigger_event in (
      'funnel_lead_captured','user_signup','subscribed','subscription_activated',
      'trial_day1','trial_day3','trial_day5','trial_day7',
      'no_subscription_7d','plan_expiring_3d','plan_expired',
      'funnel_dropoff','payment_captured'
    ));
exception when undefined_table then null;
end $$;

-- ============================================================
-- 1. funnel_engagement_events (raw stream)
-- ============================================================
create table if not exists public.funnel_engagement_events (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  viewer_phone text,
  viewer_email text,
  session_id text not null,
  event_type text not null check (event_type in (
    'view_start','progress_25','progress_50','progress_75',
    'completed','lead_submitted','exit'
  )),
  video_position_sec int,
  video_duration_sec int,
  created_at timestamptz not null default now()
);

create index if not exists idx_funnel_engagement_lookup
  on public.funnel_engagement_events(funnel_id, session_id, event_type);
create index if not exists idx_funnel_engagement_recent
  on public.funnel_engagement_events(created_at desc);

alter table public.funnel_engagement_events enable row level security;

drop policy if exists "public insert engagement" on public.funnel_engagement_events;
create policy "public insert engagement" on public.funnel_engagement_events
  for insert to anon, authenticated with check (true);

drop policy if exists "admins read engagement" on public.funnel_engagement_events;
create policy "admins read engagement" on public.funnel_engagement_events
  for select using (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- 2. funnel_engagement_sessions (rollup — cheap to scan for exit detector)
-- ============================================================
create table if not exists public.funnel_engagement_sessions (
  session_id text primary key,
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  viewer_phone text,
  viewer_email text,
  last_event text not null,
  last_event_at timestamptz not null default now(),
  followup_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_funnel_sessions_scan
  on public.funnel_engagement_sessions(last_event, last_event_at)
  where followup_sent_at is null;

alter table public.funnel_engagement_sessions enable row level security;

drop policy if exists "public upsert sessions" on public.funnel_engagement_sessions;
create policy "public upsert sessions" on public.funnel_engagement_sessions
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "admins read sessions" on public.funnel_engagement_sessions;
create policy "admins read sessions" on public.funnel_engagement_sessions
  for select using (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- 3. payment_provider_settings (single row, admin-editable)
-- ============================================================
create table if not exists public.payment_provider_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay',
  key_id text,
  key_secret text,
  webhook_secret text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.payment_provider_settings enable row level security;

drop policy if exists "admins manage payment settings" on public.payment_provider_settings;
create policy "admins manage payment settings" on public.payment_provider_settings
  for all using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

insert into public.payment_provider_settings (provider, is_active)
select 'razorpay', false
where not exists (select 1 from public.payment_provider_settings);

-- ============================================================
-- 4. payment_webhook_log
-- ============================================================
create table if not exists public.payment_webhook_log (
  id uuid primary key default gen_random_uuid(),
  event_id text unique,
  event_type text not null,
  payload jsonb,
  processed_at timestamptz not null default now(),
  status text not null default 'ok',
  error text
);

create index if not exists idx_payment_webhook_log_time
  on public.payment_webhook_log(processed_at desc);

alter table public.payment_webhook_log enable row level security;

drop policy if exists "admins read payment log" on public.payment_webhook_log;
create policy "admins read payment log" on public.payment_webhook_log
  for select using (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- 5. meta_pixel_settings (single row, admin-editable)
-- ============================================================
create table if not exists public.meta_pixel_settings (
  id uuid primary key default gen_random_uuid(),
  pixel_id text,
  access_token text,
  test_event_code text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.meta_pixel_settings enable row level security;

drop policy if exists "admins manage meta pixel" on public.meta_pixel_settings;
create policy "admins manage meta pixel" on public.meta_pixel_settings
  for all using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

insert into public.meta_pixel_settings (is_active)
select false
where not exists (select 1 from public.meta_pixel_settings);

-- ============================================================
-- 6. meta_pixel_events_log
-- ============================================================
create table if not exists public.meta_pixel_events_log (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_id text,
  user_phone text,
  user_email text,
  funnel_id uuid references public.funnels(id) on delete set null,
  custom_data jsonb,
  sent_at timestamptz not null default now(),
  response jsonb,
  success boolean not null default false
);

create unique index if not exists uq_meta_pixel_event_id
  on public.meta_pixel_events_log(event_id) where event_id is not null;
create index if not exists idx_meta_pixel_log_time
  on public.meta_pixel_events_log(sent_at desc);

alter table public.meta_pixel_events_log enable row level security;

drop policy if exists "admins read pixel log" on public.meta_pixel_events_log;
create policy "admins read pixel log" on public.meta_pixel_events_log
  for select using (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- SEED — Payment Confirmation template
-- ============================================================
insert into public.whatsapp_templates (name, body, category)
select 'Payment Confirmation',
'🎉 Payment received, {{name}}! You''re now on the {{plan}} plan.

📄 Invoice: {{invoice_link}}
🚀 Get started: {{app_link}}

Any questions? Just reply here.',
'onboarding'
where not exists (
  select 1 from public.whatsapp_templates where name = 'Payment Confirmation'
);

-- ============================================================
-- SEED — Funnel Dropoff Followup automation + templates
-- ============================================================
do $$
declare
  v_auto_id uuid;
  v_tpl1 uuid;
  v_tpl2 uuid;
begin
  insert into public.whatsapp_templates (name, body, category)
  select 'Funnel Dropoff - Check In',
    'Hi {{name}} 👋 Saw you were checking out our video — got any questions? Happy to help.',
    'nurture'
  where not exists (select 1 from public.whatsapp_templates where name = 'Funnel Dropoff - Check In');

  insert into public.whatsapp_templates (name, body, category)
  select 'Funnel Dropoff - Case Study',
    'Hey {{name}}, here''s how creators are using Nevorai to capture leads from a single video link: {{link}}',
    'nurture'
  where not exists (select 1 from public.whatsapp_templates where name = 'Funnel Dropoff - Case Study');

  select id into v_tpl1 from public.whatsapp_templates where name = 'Funnel Dropoff - Check In' limit 1;
  select id into v_tpl2 from public.whatsapp_templates where name = 'Funnel Dropoff - Case Study' limit 1;

  select id into v_auto_id from public.whatsapp_automations where name = 'Funnel Dropoff Followup' limit 1;
  if v_auto_id is null then
    insert into public.whatsapp_automations (name, description, trigger_event, is_active)
    values ('Funnel Dropoff Followup',
            'Follow up with viewers who watched but didn''t complete or submit lead form',
            'funnel_dropoff', false)
    returning id into v_auto_id;

    insert into public.whatsapp_automation_steps (automation_id, step_order, delay_hours, template_id, stop_if_subscribed) values
      (v_auto_id, 1, 0,  v_tpl1, true),
      (v_auto_id, 2, 24, v_tpl2, true);
  end if;
end $$;
