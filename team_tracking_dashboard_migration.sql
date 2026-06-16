-- =====================================================================
-- Nevorai — Team Tracking Dashboard (Phase 1, network-marketer-simple)
-- Run AFTER team_tracking_share_links_migration.sql + team_connect_links_migration.sql.
-- Safe to re-run (idempotent).
-- =====================================================================

-- 1) Secondary dedup fallback: ip_ua_hash ------------------------------
alter table public.link_events
  add column if not exists ip_ua_hash text;

create index if not exists idx_link_events_dedup
  on public.link_events (share_link_id, funnel_id, coalesce(visitor_fingerprint, ip_ua_hash));

-- 2) Normalize phones for lead dedup -----------------------------------
-- Generated column = last 10 digits of phone. Empty string if no phone.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='funnel_leads' and column_name='phone_normalized'
  ) then
    alter table public.funnel_leads
      add column phone_normalized text
      generated always as (right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 10)) stored;
  end if;
end $$;

create index if not exists idx_funnel_leads_phone_norm
  on public.funnel_leads(funnel_id, phone_normalized) where phone_normalized is not null and phone_normalized <> '';

-- 3) Team labels --------------------------------------------------------
create table if not exists public.team_labels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

grant select, insert, update, delete on public.team_labels to authenticated;
grant all on public.team_labels to service_role;

alter table public.team_labels enable row level security;

drop policy if exists "team_labels_owner_all" on public.team_labels;
create policy "team_labels_owner_all"
  on public.team_labels for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

alter table public.funnel_share_links
  add column if not exists label_id uuid references public.team_labels(id) on delete set null;
create index if not exists idx_share_links_label on public.funnel_share_links(label_id);

-- 4) Per-user column order config --------------------------------------
create table if not exists public.tracking_column_config (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  funnel_order uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.tracking_column_config to authenticated;
grant all on public.tracking_column_config to service_role;

alter table public.tracking_column_config enable row level security;

drop policy if exists "tracking_col_owner_all" on public.tracking_column_config;
create policy "tracking_col_owner_all"
  on public.tracking_column_config for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- 5) Tracking RPC v2 — also stamps ip_ua_hash --------------------------
create or replace function public.track_link_event_v2(
  p_token text,
  p_step_id uuid,
  p_event_type text,
  p_fingerprint text,
  p_user_agent text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_id uuid;
  v_funnel_id uuid;
  v_ip text;
  v_ipua_hash text;
begin
  if p_event_type not in ('view','lead','complete') then
    return null;
  end if;

  select id, funnel_id into v_link_id, v_funnel_id
  from public.funnel_share_links
  where token = p_token and is_active = true;

  if v_link_id is null then return null; end if;

  begin
    v_ip := coalesce(
      current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for',
      current_setting('request.headers', true)::jsonb ->> 'cf-connecting-ip',
      ''
    );
  exception when others then
    v_ip := '';
  end;
  v_ipua_hash := encode(digest(coalesce(v_ip,'') || '|' || coalesce(p_user_agent,''), 'sha256'), 'hex');

  insert into public.link_events
    (share_link_id, funnel_id, funnel_step_id, event_type, visitor_fingerprint, ip_ua_hash, user_agent)
  values
    (v_link_id, v_funnel_id, p_step_id, p_event_type, p_fingerprint, v_ipua_hash, p_user_agent)
  on conflict on constraint uq_link_events_unique_view do nothing;

  if p_event_type <> 'view' then
    -- non-view events have no unique constraint; ensure a row exists
    if not found then
      insert into public.link_events
        (share_link_id, funnel_id, funnel_step_id, event_type, visitor_fingerprint, ip_ua_hash, user_agent)
      values
        (v_link_id, v_funnel_id, p_step_id, p_event_type, p_fingerprint, v_ipua_hash, p_user_agent);
    end if;
  end if;

  return v_link_id;
end;
$$;

grant execute on function public.track_link_event_v2(text, uuid, text, text, text) to anon, authenticated;

-- 6) Cross-funnel team tracking matrix ---------------------------------
create or replace function public.get_team_tracking(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_result jsonb;
begin
  if v_owner is null then
    return jsonb_build_object('funnels','[]'::jsonb,'members','[]'::jsonb,
      'totals', jsonb_build_object('per_funnel','[]'::jsonb,'grand_viewers',0,'grand_leads',0));
  end if;

  with my_funnels as (
    select f.id, f.title
    from public.funnels f
    where f.owner_id = v_owner
  ),
  -- Members = me + my active team connections
  team as (
    select v_owner as user_id
    union
    select tc.member_id from public.team_connections tc
    where tc.upline_id = v_owner and tc.status = 'active'
  ),
  member_meta as (
    select t.user_id,
           coalesce(nullif(p.full_name,''), p.email, 'Member') as name,
           p.avatar_url,
           (t.user_id = v_owner) as is_you,
           -- Label = most recent non-null label_id on any of that member's share_links
           (
             select sl.label_id
             from public.funnel_share_links sl
             join my_funnels mf on mf.id = sl.funnel_id
             where coalesce(sl.assigned_user_id, sl.owner_id) = t.user_id
               and sl.label_id is not null
             order by sl.created_at desc
             limit 1
           ) as label_id
    from team t
    left join public.profiles p on p.id = t.user_id
  ),
  -- Share links scoped to caller's funnels, grouped by "effective owner" (assigned_user_id or owner)
  link_owner as (
    select sl.id as share_link_id,
           sl.funnel_id,
           coalesce(sl.assigned_user_id, sl.owner_id) as member_id
    from public.funnel_share_links sl
    join my_funnels mf on mf.id = sl.funnel_id
  ),
  ev as (
    select lo.member_id, lo.funnel_id,
           coalesce(e.visitor_fingerprint, e.ip_ua_hash) as dedup_key
    from public.link_events e
    join link_owner lo on lo.share_link_id = e.share_link_id
    where e.event_type = 'view'
      and (p_from is null or e.created_at >= p_from)
      and (p_to   is null or e.created_at <  p_to)
      and coalesce(e.visitor_fingerprint, e.ip_ua_hash) is not null
  ),
  viewer_counts as (
    select member_id, funnel_id, count(distinct dedup_key)::bigint as viewers
    from ev group by member_id, funnel_id
  ),
  lead_counts as (
    select lo.member_id, lo.funnel_id,
           count(distinct fl.phone_normalized)::bigint as leads
    from public.funnel_leads fl
    join link_owner lo on lo.share_link_id = fl.share_link_id
    where fl.phone_normalized is not null
      and fl.phone_normalized <> ''
      and (p_from is null or fl.submitted_at >= p_from)
      and (p_to   is null or fl.submitted_at <  p_to)
    group by lo.member_id, lo.funnel_id
  ),
  matrix as (
    select mm.user_id as member_id, mf.id as funnel_id,
           coalesce(vc.viewers, 0) as viewers,
           coalesce(lc.leads, 0) as leads
    from member_meta mm
    cross join my_funnels mf
    left join viewer_counts vc on vc.member_id = mm.user_id and vc.funnel_id = mf.id
    left join lead_counts   lc on lc.member_id = mm.user_id and lc.funnel_id = mf.id
  ),
  member_rows as (
    select mm.user_id as id, mm.name, mm.avatar_url, mm.is_you, mm.label_id,
           coalesce(jsonb_agg(jsonb_build_object(
             'funnel_id', m.funnel_id,
             'viewers',   m.viewers,
             'leads',     m.leads
           ) order by m.funnel_id) filter (where m.funnel_id is not null), '[]'::jsonb) as funnels,
           coalesce(sum(m.viewers),0)::bigint as total_viewers,
           coalesce(sum(m.leads),  0)::bigint as total_leads
    from member_meta mm
    left join matrix m on m.member_id = mm.user_id
    group by mm.user_id, mm.name, mm.avatar_url, mm.is_you, mm.label_id
  ),
  per_funnel as (
    select mf.id as funnel_id,
           coalesce(sum(m.viewers),0)::bigint as viewers,
           coalesce(sum(m.leads),  0)::bigint as leads
    from my_funnels mf
    left join matrix m on m.funnel_id = mf.id
    group by mf.id
  )
  select jsonb_build_object(
    'funnels', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', title) order by title) from my_funnels), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(to_jsonb(member_rows) order by is_you desc, name asc) from member_rows), '[]'::jsonb),
    'totals', jsonb_build_object(
      'per_funnel', coalesce((select jsonb_agg(jsonb_build_object('funnel_id', funnel_id, 'viewers', viewers, 'leads', leads)) from per_funnel), '[]'::jsonb),
      'grand_viewers', coalesce((select sum(viewers) from per_funnel), 0),
      'grand_leads',   coalesce((select sum(leads)   from per_funnel), 0)
    )
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_team_tracking(timestamptz, timestamptz) to authenticated;

-- 7) Assign a label to ALL of a member's share links under this owner --
create or replace function public.assign_member_label(
  p_member_id uuid,
  p_label_id uuid
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_count int;
begin
  if v_owner is null then raise exception 'not authenticated'; end if;

  if p_label_id is not null then
    if not exists (select 1 from public.team_labels where id = p_label_id and owner_id = v_owner) then
      raise exception 'label not found';
    end if;
  end if;

  update public.funnel_share_links sl
     set label_id = p_label_id
   where sl.owner_id = v_owner
     and coalesce(sl.assigned_user_id, sl.owner_id) = p_member_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.assign_member_label(uuid, uuid) to authenticated;
