-- =====================================================================
-- Nevorai — Team Connect Links (Phase 1, replaces manual named links)
-- Run AFTER team_tracking_share_links_migration.sql.
-- Safe to re-run (idempotent).
--
-- Model:
--   * Every user has ONE stable connect token (profiles.connect_token).
--   * A team member opens /join/<token>, signs in, and is connected to the upline.
--   * On connect: a personal funnel_share_links row is auto-created for EVERY
--     funnel the upline already owns.
--   * On new funnel: a personal share link is auto-created for EVERY connected
--     team member.
--   * Tracking + dashboard already work via team_tracking_stats from the previous
--     migration — no changes needed there.
-- =====================================================================

-- 1) Stable per-user connect token --------------------------------------
alter table public.profiles
  add column if not exists connect_token text unique;

-- Backfill tokens for existing users.
update public.profiles
   set connect_token = lower(
     replace(replace(replace(encode(gen_random_bytes(6), 'base64'), '/', '_'), '+', '-'), '=', '')
   )
 where connect_token is null;

-- Ensure new users always get a token.
create or replace function public.profiles_set_connect_token()
returns trigger language plpgsql as $$
begin
  if new.connect_token is null then
    new.connect_token := lower(
      replace(replace(replace(encode(gen_random_bytes(6), 'base64'), '/', '_'), '+', '-'), '=', '')
    );
  end if;
  return new;
end; $$;

drop trigger if exists trg_profiles_set_connect_token on public.profiles;
create trigger trg_profiles_set_connect_token
  before insert on public.profiles
  for each row execute function public.profiles_set_connect_token();

-- Public RLS already exposes display_name/avatar/is_verified via profiles_public.
-- connect_token is NOT in that view, so it stays private to the owner.

-- 2) team_connections (upline ←→ member) --------------------------------
create table if not exists public.team_connections (
  id uuid primary key default gen_random_uuid(),
  upline_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','revoked')),
  source text not null default 'connect_link' check (source in ('connect_link','qr','email_invite','manual')),
  connected_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (upline_id, member_id),
  check (upline_id <> member_id)
);

create index if not exists idx_team_conn_upline on public.team_connections(upline_id) where status = 'active';
create index if not exists idx_team_conn_member on public.team_connections(member_id) where status = 'active';

grant select, insert, update on public.team_connections to authenticated;
grant all on public.team_connections to service_role;

alter table public.team_connections enable row level security;

drop policy if exists "team_conn_upline_read"   on public.team_connections;
drop policy if exists "team_conn_member_read"   on public.team_connections;
drop policy if exists "team_conn_upline_update" on public.team_connections;

create policy "team_conn_upline_read"
  on public.team_connections for select to authenticated
  using (auth.uid() = upline_id);

create policy "team_conn_member_read"
  on public.team_connections for select to authenticated
  using (auth.uid() = member_id);

-- Only the upline may revoke; inserts happen only through the RPC below.
create policy "team_conn_upline_update"
  on public.team_connections for update to authenticated
  using (auth.uid() = upline_id)
  with check (auth.uid() = upline_id);

-- 3) funnel_share_links: enforce 1 personal link per (funnel, member) ---
-- (We keep the table as-is. Just guarantee no duplicates per assigned user.)
create unique index if not exists uq_share_links_funnel_member
  on public.funnel_share_links(funnel_id, assigned_user_id)
  where assigned_user_id is not null;

-- Members can read their own assigned links (so a member dashboard can list them).
drop policy if exists "share_links_assigned_member_read" on public.funnel_share_links;
create policy "share_links_assigned_member_read"
  on public.funnel_share_links for select to authenticated
  using (auth.uid() = assigned_user_id);

-- 4) Token helper -------------------------------------------------------
create or replace function public.gen_share_token()
returns text language sql volatile as $$
  select lower(
    replace(replace(replace(encode(gen_random_bytes(6), 'base64'), '/', '_'), '+', '-'), '=', '')
  );
$$;

-- 5) Auto-create share link for (funnel, member) ------------------------
create or replace function public.ensure_member_share_link(
  p_funnel_id uuid,
  p_member_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_existing uuid;
  v_token text;
  v_label text;
  v_link_id uuid;
begin
  select owner_id into v_owner from public.funnels where id = p_funnel_id;
  if v_owner is null then return null; end if;

  -- Must be an active connection between owner and member.
  if not exists (
    select 1 from public.team_connections
    where upline_id = v_owner and member_id = p_member_id and status = 'active'
  ) then
    return null;
  end if;

  -- Already exists?
  select id into v_existing
    from public.funnel_share_links
   where funnel_id = p_funnel_id and assigned_user_id = p_member_id;
  if v_existing is not null then return v_existing; end if;

  -- Derive label from profile (no manual naming).
  select coalesce(nullif(full_name, ''), nullif(email, ''), 'Team Member')
    into v_label from public.profiles where id = p_member_id;

  -- Unique token (retry if collision).
  loop
    v_token := public.gen_share_token();
    exit when not exists (select 1 from public.funnel_share_links where token = v_token);
  end loop;

  insert into public.funnel_share_links
    (funnel_id, owner_id, label, token, assigned_user_id, is_universal, is_active)
  values
    (p_funnel_id, v_owner, v_label, v_token, p_member_id, false, true)
  returning id into v_link_id;

  return v_link_id;
end; $$;

grant execute on function public.ensure_member_share_link(uuid, uuid) to authenticated, service_role;

-- 6) Connect RPC: member calls this with the upline's token -------------
create or replace function public.connect_to_upline(p_token text, p_source text default 'connect_link')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_upline uuid;
  v_member uuid := auth.uid();
  v_conn_id uuid;
  v_funnel uuid;
begin
  if v_member is null then
    raise exception 'must be signed in';
  end if;

  select id into v_upline from public.profiles where connect_token = p_token;
  if v_upline is null then
    raise exception 'invalid connect token';
  end if;
  if v_upline = v_member then
    raise exception 'cannot connect to yourself';
  end if;

  -- Upsert the connection (re-activate if previously revoked).
  insert into public.team_connections (upline_id, member_id, source, status)
  values (v_upline, v_member, coalesce(p_source, 'connect_link'), 'active')
  on conflict (upline_id, member_id) do update
    set status = 'active', revoked_at = null, source = excluded.source
  returning id into v_conn_id;

  -- Auto-create a personal share link for every existing funnel of the upline.
  for v_funnel in
    select id from public.funnels where owner_id = v_upline
  loop
    perform public.ensure_member_share_link(v_funnel, v_member);
  end loop;

  return v_conn_id;
end; $$;

grant execute on function public.connect_to_upline(text, text) to authenticated;

-- 7) Auto-create links when a NEW funnel is added by an upline ----------
create or replace function public.funnels_after_insert_seed_team_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid;
begin
  for v_member in
    select member_id from public.team_connections
     where upline_id = new.owner_id and status = 'active'
  loop
    perform public.ensure_member_share_link(new.id, v_member);
  end loop;
  return new;
end; $$;

drop trigger if exists trg_funnels_seed_team_links on public.funnels;
create trigger trg_funnels_seed_team_links
  after insert on public.funnels
  for each row execute function public.funnels_after_insert_seed_team_links();

-- 8) Auto-create links when a connection becomes active -----------------
create or replace function public.team_connections_after_activate_seed_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funnel uuid;
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    for v_funnel in select id from public.funnels where owner_id = new.upline_id
    loop
      perform public.ensure_member_share_link(v_funnel, new.member_id);
    end loop;
  end if;
  return new;
end; $$;

drop trigger if exists trg_team_conn_seed_links_ins on public.team_connections;
drop trigger if exists trg_team_conn_seed_links_upd on public.team_connections;

create trigger trg_team_conn_seed_links_ins
  after insert on public.team_connections
  for each row execute function public.team_connections_after_activate_seed_links();

create trigger trg_team_conn_seed_links_upd
  after update on public.team_connections
  for each row execute function public.team_connections_after_activate_seed_links();

-- 9) Deactivate links when a connection is revoked ----------------------
create or replace function public.team_connections_after_revoke_disable_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status = 'revoked' and old.status = 'active' then
    update public.funnel_share_links
       set is_active = false
     where assigned_user_id = new.member_id
       and funnel_id in (select id from public.funnels where owner_id = new.upline_id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_team_conn_revoke_disable_links on public.team_connections;
create trigger trg_team_conn_revoke_disable_links
  after update on public.team_connections
  for each row execute function public.team_connections_after_revoke_disable_links();

-- 10) Owner-facing "my team" view ---------------------------------------
-- One row per (connected member × funnel) with the personal token.
-- The upline reads this directly; RLS enforced via the underlying tables.
create or replace view public.team_member_links as
select
  tc.upline_id,
  tc.member_id,
  tc.connected_at,
  tc.source,
  tc.status as connection_status,
  p.full_name as member_name,
  p.email     as member_email,
  p.avatar_url as member_avatar,
  f.id        as funnel_id,
  f.title     as funnel_title,
  f.slug      as funnel_slug,
  sl.id       as share_link_id,
  sl.token    as share_token,
  sl.is_active as link_active
from public.team_connections tc
join public.profiles p on p.id = tc.member_id
join public.funnels  f on f.owner_id = tc.upline_id
left join public.funnel_share_links sl
       on sl.funnel_id = f.id and sl.assigned_user_id = tc.member_id
where tc.status = 'active';

grant select on public.team_member_links to authenticated;

-- 11) Backfill any missing links for already-existing connections -------
do $$
declare r record;
begin
  for r in
    select tc.upline_id, tc.member_id, f.id as funnel_id
    from public.team_connections tc
    join public.funnels f on f.owner_id = tc.upline_id
    left join public.funnel_share_links sl
           on sl.funnel_id = f.id and sl.assigned_user_id = tc.member_id
    where tc.status = 'active' and sl.id is null
  loop
    perform public.ensure_member_share_link(r.funnel_id, r.member_id);
  end loop;
end $$;
