-- =====================================================================
-- Nevorai — Team Tracking via Named Share Links (Phase 1)
-- Run this in Supabase SQL Editor. Safe to re-run (idempotent).
-- =====================================================================

-- 1) Trackable share link per team member, per funnel ------------------
create table if not exists public.funnel_share_links (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  token text not null unique,
  assigned_user_id uuid references auth.users(id),     -- reserved for Phase 2
  is_universal boolean not null default false,         -- the auto "Direct" link
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_share_links_funnel       on public.funnel_share_links(funnel_id);
create index if not exists idx_share_links_owner        on public.funnel_share_links(owner_id);
create unique index if not exists uq_share_links_universal_per_funnel
  on public.funnel_share_links(funnel_id) where is_universal = true;

grant select, insert, update, delete on public.funnel_share_links to authenticated;
grant select on public.funnel_share_links to anon;       -- public viewer resolves token
grant all on public.funnel_share_links to service_role;

alter table public.funnel_share_links enable row level security;

drop policy if exists "share_links_owner_all"     on public.funnel_share_links;
drop policy if exists "share_links_public_read"   on public.funnel_share_links;

create policy "share_links_owner_all"
  on public.funnel_share_links
  for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Anon can only resolve an active link (needed for the public viewer).
create policy "share_links_public_read"
  on public.funnel_share_links
  for select
  to anon, authenticated
  using (is_active = true);

-- 2) Raw tracking events ----------------------------------------------
create table if not exists public.link_events (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references public.funnel_share_links(id) on delete cascade,
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  funnel_step_id uuid references public.funnel_steps(id) on delete set null,
  event_type text not null check (event_type in ('view','lead','complete')),
  visitor_fingerprint text,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_link_events_link
  on public.link_events(share_link_id, funnel_step_id, event_type);
create index if not exists idx_link_events_funnel_created
  on public.link_events(funnel_id, created_at desc);
-- Dedupe support: one unique (link, step, fingerprint, type='view') per device
create unique index if not exists uq_link_events_unique_view
  on public.link_events(share_link_id, funnel_step_id, visitor_fingerprint)
  where event_type = 'view' and visitor_fingerprint is not null;

grant select on public.link_events to authenticated;     -- owner reads via RLS below
grant all on public.link_events to service_role;
-- anon writes ONLY through the SECURITY DEFINER RPC below; no direct grants.

alter table public.link_events enable row level security;

drop policy if exists "link_events_owner_select" on public.link_events;
create policy "link_events_owner_select"
  on public.link_events
  for select
  to authenticated
  using (exists (
    select 1 from public.funnels f
    where f.id = link_events.funnel_id and f.owner_id = auth.uid()
  ));

-- 3) Attribute leads to a share link ----------------------------------
alter table public.funnel_leads
  add column if not exists share_link_id uuid references public.funnel_share_links(id) on delete set null;
create index if not exists idx_funnel_leads_share_link on public.funnel_leads(share_link_id);

-- 4) Public tracking RPC (anon-callable) ------------------------------
create or replace function public.track_link_event(
  p_token text,
  p_step_id uuid,
  p_event_type text,
  p_fingerprint text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_id uuid;
  v_funnel_id uuid;
  v_event_id uuid;
begin
  if p_event_type not in ('view','lead','complete') then
    return null;
  end if;

  select id, funnel_id into v_link_id, v_funnel_id
  from public.funnel_share_links
  where token = p_token and is_active = true;

  if v_link_id is null then
    return null;
  end if;

  -- Dedupe unique views via the partial unique index.
  insert into public.link_events (share_link_id, funnel_id, funnel_step_id, event_type, visitor_fingerprint)
  values (v_link_id, v_funnel_id, p_step_id, p_event_type, p_fingerprint)
  on conflict on constraint uq_link_events_unique_view do nothing
  returning id into v_event_id;

  -- For non-view events we always want to log (no unique constraint applies).
  if v_event_id is null and p_event_type <> 'view' then
    insert into public.link_events (share_link_id, funnel_id, funnel_step_id, event_type, visitor_fingerprint)
    values (v_link_id, v_funnel_id, p_step_id, p_event_type, p_fingerprint)
    returning id into v_event_id;
  end if;

  return v_link_id;   -- viewer uses this to stamp share_link_id on the lead
end;
$$;

grant execute on function public.track_link_event(text, uuid, text, text) to anon, authenticated;

-- 5) Helper: ensure a "Direct / Universal" link exists for a funnel ---
create or replace function public.ensure_universal_share_link(p_funnel_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_link_id uuid;
  v_token text;
begin
  select owner_id into v_owner from public.funnels where id = p_funnel_id;
  if v_owner is null then
    raise exception 'funnel not found';
  end if;

  -- Only the owner (or service role) may bootstrap the universal link.
  if auth.uid() is not null and auth.uid() <> v_owner then
    raise exception 'not authorized';
  end if;

  select id into v_link_id from public.funnel_share_links
   where funnel_id = p_funnel_id and is_universal = true;
  if v_link_id is not null then
    return v_link_id;
  end if;

  v_token := lower(replace(encode(gen_random_bytes(6), 'base64'), '/', '_'));
  v_token := replace(replace(v_token, '+', '-'), '=', '');

  insert into public.funnel_share_links (funnel_id, owner_id, label, token, is_universal)
  values (p_funnel_id, v_owner, 'Direct / Universal', v_token, true)
  returning id into v_link_id;

  return v_link_id;
end;
$$;

grant execute on function public.ensure_universal_share_link(uuid) to authenticated;

-- 6) Aggregation RPC for the team-tracking dashboard ------------------
-- Returns one row per (share_link, step) with totals + unique + leads.
-- Caller must own the funnel.
create or replace function public.team_tracking_stats(
  p_funnel_id uuid,
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (
  share_link_id uuid,
  label text,
  is_universal boolean,
  funnel_step_id uuid,
  step_title text,
  step_order int,
  total_views bigint,
  unique_views bigint,
  leads bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    select id, owner_id from public.funnels
    where id = p_funnel_id
      and (auth.uid() = owner_id or auth.role() = 'service_role')
  ),
  links as (
    select sl.id, sl.label, sl.is_universal
    from public.funnel_share_links sl
    join allowed a on a.id = sl.funnel_id
  ),
  steps as (
    select s.id, s.title, s.step_order from public.funnel_steps s where s.funnel_id = p_funnel_id
  ),
  ev as (
    select e.*
    from public.link_events e
    join links l on l.id = e.share_link_id
    where (p_from is null or e.created_at >= p_from)
      and (p_to   is null or e.created_at <  p_to)
  ),
  lds as (
    select fl.share_link_id, count(*)::bigint as leads
    from public.funnel_leads fl
    join links l on l.id = fl.share_link_id
    where fl.funnel_id = p_funnel_id
      and (p_from is null or fl.submitted_at >= p_from)
      and (p_to   is null or fl.submitted_at <  p_to)
    group by fl.share_link_id
  )
  select
    l.id as share_link_id,
    l.label,
    l.is_universal,
    s.id as funnel_step_id,
    s.title as step_title,
    s.step_order,
    coalesce(sum(case when ev.event_type = 'view' then 1 else 0 end), 0)::bigint as total_views,
    coalesce(count(distinct case when ev.event_type = 'view' then ev.visitor_fingerprint end), 0)::bigint as unique_views,
    coalesce(max(lds.leads), 0)::bigint as leads
  from links l
  cross join steps s
  left join ev on ev.share_link_id = l.id and ev.funnel_step_id = s.id
  left join lds on lds.share_link_id = l.id
  group by l.id, l.label, l.is_universal, s.id, s.title, s.step_order
  order by l.is_universal desc, l.label asc, s.step_order asc;
$$;

grant execute on function public.team_tracking_stats(uuid, timestamptz, timestamptz) to authenticated;
